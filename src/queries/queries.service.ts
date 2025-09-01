import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateQueryDto } from './dto/create-query.dto';
import { UpdateQueryDto } from './dto/update-query.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MutateQueryResponseDto } from './dto/mutate-query-response.dto';
import { Prisma } from '@prisma/client';
import { DocumentResponseDto } from 'src/insurance-requests/dto/mutate-response-insurance-requests.dto';
import { CommonService } from 'src/common/common.service';

@Injectable()
export class QueriesService {

    constructor(
      private prisma: PrismaService,
      private readonly commonService: CommonService
    ) {}

  async create(
    data: CreateQueryDto,
    uploadedBy: string,
    userName: string
  ): Promise<MutateQueryResponseDto> {
    const { insuranceRequestId, enhancementId, documents, resolvedRemarks, isResolved, ...rest } = data;
    if(resolvedRemarks || isResolved) throw new BadRequestException("Resolved details can't be added on create!")

    const claim = await this.prisma.insuranceRequest.findUnique({ where: { id: insuranceRequestId } });
    if (!claim) throw new BadRequestException('Invalid claim ID');
    
    const createdQuery = await this.prisma.query.create({ 
      data : { 
        ...rest, 
        insuranceRequest: { connect: { id: insuranceRequestId }},
        enhancement: enhancementId ? { connect: { id: enhancementId }} : undefined
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

    if(!createdQuery) throw new BadRequestException("Failed to create query!")
    const patientHospitalId = createdQuery.insuranceRequest.patient.hospital.id
    const notifiedTo = createdQuery.insuranceRequest.assignedTo
    const refNumber = createdQuery.insuranceRequest.refNumber

    // notify to assignee and hospital user
    const notificationPayload = {
        userId: uploadedBy,
        insuranceRequestId,
        message: `${userName} created ${enhancementId ? 'enhancement query' : 'query'} for claim ${refNumber}`
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
    // await this.commonService.logInsuranceRequestNotification({
    //   userId: uploadedBy,
    //   notifiedTo,
    //   insuranceRequestId,
    //   message: `${userName} created ${enhancementId ? 'enhancement query' : 'query'} for claim ${refNumber}`
    // })

    const createdDocuments = await this.prisma.document.createManyAndReturn({
      data: documents.map((document) => ({
        ...document,
        uploadedBy,
        insuranceRequestId,
        queryId: createdQuery.id,
        enhancementId: enhancementId ? enhancementId : undefined
      })),
      select: { id: true , insuranceRequestId: true , enhancementId: true, fileName: true , type: true }
    })

    if(!createdDocuments.length) throw new BadRequestException("Failed to create documents!")

    // notify and create comment for hospital and assignee
    const notifyAndHistoryPayload = {
      userId: uploadedBy,
      insuranceRequestId,
      message: `${userName} uploaded ${createdDocuments.length} document(s) for ${refNumber}'s ${enhancementId ? 'enhancement query' : 'query'}.`,
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

    // await this.commonService.logInsuranceRequestChange({
    //   userId: uploadedBy,
    //   notifiedTo,
    //   insuranceRequestId,
    //   hospitalId: patientHospitalId,
    //   message: `${userName} uploaded ${createdDocuments.length} document(s) for ${refNumber}'s ${enhancementId ? 'enhancement query' : 'query'}.`,
    // });

    return {
      id: createdQuery.id,
      refNumber: createdQuery.insuranceRequest.refNumber,
      enhancementId: enhancementId ? enhancementId : undefined,
      notes: createdQuery.notes ? createdQuery.notes : undefined, 
      documents: createdDocuments
    }
  }
  
  async update(params: {
    where: Prisma.QueryWhereUniqueInput,
    data: UpdateQueryDto,
    uploadedBy: string,
    userName: string
  }): Promise<MutateQueryResponseDto> {

    const { where, data, uploadedBy, userName } = params;
    const { documents, insuranceRequestId, enhancementId, ...rest } = data;
    let updatedDocuments: DocumentResponseDto[] = []
    let createdDocuments: DocumentResponseDto[] = []

    const queryExists = await this.prisma.query.findUnique({ 
      where ,
      select: { id: true } 
    })
    if(!queryExists) throw new BadRequestException('Invalid query ID');

    const updatedQuery = await this.prisma.query.update({
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

    if(!updatedQuery) throw new BadRequestException("Failed to update query!")
    const patientHospitalId = updatedQuery.insuranceRequest.patient.hospital.id
    const notifiedTo = updatedQuery.insuranceRequest.assignedTo
    const refNumber = updatedQuery.insuranceRequest.refNumber

    await this.commonService.logActivity(
      uploadedBy,
      `${userName} updated ${updatedQuery.enhancementId ? 'enhancement query' : 'query'} for claim ${refNumber}`,
      "Enhancement",
      updatedQuery.id,
    );

    // notify and create comment for hospital and assignee
    const notifyAndHistoryPayload = {
      userId: uploadedBy,
      insuranceRequestId: updatedQuery.insuranceRequest.id
    }

    if(data.isResolved){
      const message = `${userName} has marked ${updatedQuery.enhancementId ? 'enhancement query' : 'query'} as resolved for claim ${refNumber}`
      await Promise.all([
          await this.commonService.logInsuranceRequestNotification({
              ...notifyAndHistoryPayload,
              notifiedTo,
              message
          }),
          await this.commonService.logInsuranceRequestNotification({
              ...notifyAndHistoryPayload,
              notifiedTo: patientHospitalId,
              message
          })
      ])
    }
    // if(data.isResolved){
    //   await this.commonService.logInsuranceRequestNotification({
    //     userId: uploadedBy,
    //     notifiedTo,
    //     insuranceRequestId: updatedQuery.insuranceRequest.id,
    //     message: `${userName} has marked ${updatedQuery.enhancementId ? 'enhancement query' : 'query'} as resolved for claim ${refNumber}`,
    //   });
    // }

    if(documents?.length){
      const newDocs = documents.filter(doc => !doc.id);
      const existingDocs = documents.filter(doc => doc.id);
  
      if(newDocs?.length){
        createdDocuments = await this.prisma.document.createManyAndReturn({
          data: newDocs.map((document) => ({
            ...document,
            uploadedBy,
            insuranceRequestId: updatedQuery.insuranceRequestId,
            queryId: updatedQuery.id,
            enhancementId: updatedQuery.enhancementId ? updatedQuery.enhancementId : undefined,
            remark: document.remark ? document.remark : undefined
          })),
          select: { id: true , insuranceRequestId: true , enhancementId: true, fileName: true , type: true }
        })
        if(!createdDocuments.length) throw new BadRequestException("Failed to create documents!")
        const message = `${userName} added ${createdDocuments.length} document(s) for ${refNumber}'s ${enhancementId ? 'enhancement query' : 'query'}.`
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

        // await this.commonService.logInsuranceRequestChange({
        //   userId: uploadedBy,
        //   notifiedTo,
        //   insuranceRequestId: updatedQuery.insuranceRequest.id,
        //   hospitalId: patientHospitalId,
        //   message:`${userName} added ${createdDocuments.length} document(s) for ${refNumber}'s ${enhancementId ? 'enhancement query' : 'query'}.`,
        // });
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

        const message = `${userName} modified ${updatedDocuments.length} document(s) for ${refNumber}'s ${enhancementId ? 'enhancement query' : 'query'}.`
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
        // await this.commonService.logInsuranceRequestChange({
        //   userId: uploadedBy,
        //   notifiedTo,
        //   insuranceRequestId: updatedQuery.insuranceRequest.id,
        //   hospitalId: patientHospitalId,
        //     message:`${userName} modified ${updatedDocuments.length} document(s) for ${refNumber}'s ${enhancementId ? 'enhancement query' : 'query'}.`,
        // });
      }
    }

    return {
      id: updatedQuery.id,
      refNumber: updatedQuery.insuranceRequest.refNumber,
      enhancementId: updatedQuery.enhancementId ? updatedQuery.enhancementId : undefined,
      notes: updatedQuery.notes ? updatedQuery.notes : undefined, 
      documents: documents?.length ? [...createdDocuments, ...updatedDocuments]: undefined
    };
  }
}
