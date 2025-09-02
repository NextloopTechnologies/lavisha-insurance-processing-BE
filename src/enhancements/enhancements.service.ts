import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateEnhancementDto } from './dto/create-enhancements.dto';
import { MutateEnhancementsResponseDto } from './dto/mutate-enhancements-response.dto';
import { Prisma } from '@prisma/client';
import { UpdateEnhancementDto } from './dto/update-enhancements.dto';
import { DocumentResponseDto } from 'src/insurance-requests/dto/mutate-response-insurance-requests.dto';
import { CommonService } from 'src/common/common.service';

@Injectable()
export class EnhancementsService {

    constructor(
        private prisma: PrismaService,
        private readonly commonService: CommonService
    ) {}

     async create(
        data: CreateEnhancementDto,
        uploadedBy: string,
        userName: string
    ): Promise<MutateEnhancementsResponseDto>{
        const { insuranceRequestId, documents, status, ...rest } = data;
        if(status) throw new BadRequestException("No status are allowed on create!")

        const claim = await this.prisma.insuranceRequest.findUnique({ where: { id: insuranceRequestId } });
        if (!claim) throw new BadRequestException('Invalid claim ID');
       
        const createdEnhancement = await this.prisma.enhancement.create({ 
            data : { 
                ...rest, 
                insuranceRequest: { connect: { id: insuranceRequestId }}
            },
            include: { 
                insuranceRequest: { 
                    select: { 
                        id: true, 
                        refNumber: true, 
                        assignedTo: true,
                        status: true, 
                        patient: { 
                            select: { id: true, name: true, hospital: { select: { id: true }} } 
                        }
                    }
                }
            }
        });
    
        if(!createdEnhancement) throw new BadRequestException("Failed to create enhancement!")
        const patientHospitalId = createdEnhancement.insuranceRequest.patient.hospital.id
        const notifiedTo = createdEnhancement.insuranceRequest.assignedTo
        const refNumber = createdEnhancement.insuranceRequest.refNumber

        // notify to assignee and hospital user
        const notificationPayload = {
            userId: uploadedBy,
            insuranceRequestId,
            message: `${userName} created enhancement for claim ${refNumber}`
        }

        await Promise.all([
            await this.commonService.logInsuranceRequestNotification({
                ...notificationPayload,
                notifiedTo,
            }),
            await this.commonService.logInsuranceRequestNotification({
                ...notificationPayload,
                notifiedTo: patientHospitalId
            })
        ])

        const createdDocuments = await this.prisma.document.createManyAndReturn({
          data: documents.map((document) => ({
            ...document,
            uploadedBy,
            insuranceRequestId,
            enhancementId: createdEnhancement.id
          })),
          select: { id: true , insuranceRequestId: true , enhancementId: true, fileName: true , type: true }
        })
    
        if(!createdDocuments.length) throw new BadRequestException("Failed to create documents!")

        // notify and create comment for hospital and assignee
        const notifyAndHistoryPayload = {
            userId: uploadedBy,
            insuranceRequestId,
            message: `${userName} uploaded ${createdDocuments.length} document(s) for ${refNumber}'s enhancement.`,
        }

        await Promise.all([
            await this.commonService.logInsuranceRequestChange({
                ...notifyAndHistoryPayload,
                notifiedTo,
                hospitalId: patientHospitalId,
            }),
            await this.commonService.logInsuranceRequestNotification({
                ...notifyAndHistoryPayload,
                notifiedTo: patientHospitalId
            })
        ])
    
        return {
          id: createdEnhancement.id,
          refNumber: createdEnhancement.insuranceRequest.refNumber,
          numberofDays: createdEnhancement.numberOfDays,
          status: createdEnhancement.status,
          notes: createdEnhancement.notes ? createdEnhancement.notes : undefined, 
          documents: createdDocuments
        }
    }

     async update(params: {
        where: Prisma.EnhancementWhereUniqueInput,
        data: UpdateEnhancementDto,
        uploadedBy: string,
        userName: string
    }): Promise<MutateEnhancementsResponseDto> {
    
        const { where, data, uploadedBy, userName } = params;
        const { documents, insuranceRequestId, ...rest } = data;
        let updatedDocuments: DocumentResponseDto[] = []
        let createdDocuments: DocumentResponseDto[] = []

        const enhancementExists = await this.prisma.enhancement.findUnique({ 
            where ,
            select: { id: true, status: true } 
        })
        if(!enhancementExists) throw new BadRequestException('Invalid enhancement ID');

        const updatedEnhancement = await this.prisma.enhancement.update({
            where,
            data: {
                ...rest
            },
            include: { 
                insuranceRequest: { 
                    select: { 
                        id: true, 
                        refNumber: true, 
                        assignedTo: true,
                        status: true, 
                        patient: { 
                            select: { id: true, name: true, hospital: { select: { id: true }} } 
                        }
                    }
                }
            }
        });

        if(!updatedEnhancement) throw new BadRequestException("Failed to update enhancement!")
        const patientHospitalId = updatedEnhancement.insuranceRequest.patient.hospital.id
        const notifiedTo = updatedEnhancement.insuranceRequest.assignedTo
        const refNumber = updatedEnhancement.insuranceRequest.refNumber

        await this.commonService.logActivity(
            uploadedBy,
            `${userName} updated enhancement for claim ${refNumber}`,
            "Enhancement",
            updatedEnhancement.id,
        );

        // notify and create comment for hospital and assignee
        const notifyAndHistoryPayload = {
            userId: uploadedBy,
            insuranceRequestId: updatedEnhancement.insuranceRequest.id
        }

        if(data.status && enhancementExists.status !== data.status){
            const message = `${userName} updated status from ${enhancementExists.status} to ${data.status} for ${refNumber}'s enhancement.`
            await Promise.all([
                await this.commonService.logInsuranceRequestChange({
                    ...notifyAndHistoryPayload,
                    notifiedTo,
                    hospitalId: patientHospitalId,
                    message
                }),
                await this.commonService.logInsuranceRequestNotification({
                    ...notifyAndHistoryPayload,
                    notifiedTo: patientHospitalId,
                    message
                })
            ])
        }

        if(documents?.length){
            const newDocs = documents.filter(doc => !doc.id);
            const existingDocs = documents.filter(doc => doc.id);
        
            if(newDocs?.length){
                createdDocuments = await this.prisma.document.createManyAndReturn({
                    data: newDocs.map((document) => ({
                        ...document,
                        uploadedBy,
                        insuranceRequestId: updatedEnhancement.insuranceRequestId,
                        enhancementId: updatedEnhancement.id,
                        remark: document.remark ? document.remark : undefined
                    })),
                    select: { id: true , insuranceRequestId: true , enhancementId: true, fileName: true , type: true }
                })
                if(!createdDocuments.length) throw new BadRequestException("Failed to create documents!")

                const message = `${userName} added ${createdDocuments.length} document(s) for ${refNumber}'s enhancement.`
                await Promise.all([
                    await this.commonService.logInsuranceRequestChange({
                        ...notifyAndHistoryPayload,
                        notifiedTo,
                        hospitalId: patientHospitalId,
                        message
                    }),
                    await this.commonService.logInsuranceRequestNotification({
                        ...notifyAndHistoryPayload,
                        notifiedTo: patientHospitalId,
                        message
                    })
                ])
            }

            if(existingDocs?.length){
                updatedDocuments = await Promise.all(
                    existingDocs.map(async doc => {
                        const existing = await this.prisma.document.findUnique({ where: { id: doc.id } });
                        if (!existing) throw new BadRequestException(`Invalid document ID: ${doc.id}`);
            
                        return this.prisma.document.update({
                            where: { id: doc.id },
                            data: {
                                fileName: doc.fileName,
                                type: doc.type,
                                uploadedBy,
                                remark: doc.remark ? doc.remark : undefined
                            },
                            select: { id: true , insuranceRequestId: true , enhancementId: true, fileName: true , type: true }
                        });
                    })
                );
                if(!updatedDocuments.length) throw new BadRequestException("Failed to update documents!")

                const message = `${userName} modified ${updatedDocuments.length} document(s) for ${refNumber}'s enhancement.`
                await Promise.all([
                    await this.commonService.logInsuranceRequestChange({
                        ...notifyAndHistoryPayload,
                        notifiedTo,
                        hospitalId: patientHospitalId,
                        message
                    }),
                    await this.commonService.logInsuranceRequestNotification({
                        ...notifyAndHistoryPayload,
                        notifiedTo: patientHospitalId,
                        message
                    })
                ])
            }
        }

        return {
            id: updatedEnhancement.id,
            refNumber: updatedEnhancement.insuranceRequest.refNumber,
            numberofDays: updatedEnhancement.numberOfDays,
            status: updatedEnhancement.status,
            notes: updatedEnhancement.notes ? updatedEnhancement.notes : undefined, 
            documents: documents?.length ? [...createdDocuments, ...updatedDocuments]: undefined
        };
    }
}
