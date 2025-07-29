import { BadRequestException, Injectable } from '@nestjs/common';
import { FileService } from 'src/file/file.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateEnhancementDto } from './dto/create-enhancements.dto';
import { MutateEnhancementsResponseDto } from './dto/mutate-enhancements-response.dto';
import { Prisma } from '@prisma/client';
import { UpdateEnhancementDto } from './dto/update-enhancements.dto';
import { DocumentResponseDto } from 'src/insurance-requests/dto/mutate-response-insurance-requests.dto';

@Injectable()
export class EnhancementsService {

    constructor(private prisma: PrismaService) {}

     async create(
        data: CreateEnhancementDto,
        uploadedBy: string
    ): Promise<MutateEnhancementsResponseDto>{
        const { insuranceRequestId, documents, ...rest } = data;
        const claim = await this.prisma.insuranceRequest.findUnique({ where: { id: insuranceRequestId } });
        if (!claim) throw new BadRequestException('Invalid claim ID');
       
        const createdEnhancement = await this.prisma.enhancement.create({ 
          data : { 
            ...rest, 
            insuranceRequest: { connect: { id: insuranceRequestId }}
          },
          include: { 
            insuranceRequest: { select: { id: true, refNumber: true, status: true }}
          }
        });
    
        if(!createdEnhancement) throw new BadRequestException("Failed to create enhancement!")
      
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
        uploadedBy: string
    }): Promise<MutateEnhancementsResponseDto> {
    
        const { where, data, uploadedBy } = params;
        const { documents, insuranceRequestId, ...rest } = data;
        let updatedDocuments: DocumentResponseDto[] = []
        let createdDocuments: DocumentResponseDto[] = []

        const updatedEnhancement = await this.prisma.enhancement.update({
            where,
            data: {
                ...rest
            },
            include: {
                insuranceRequest: { select: { id: true, refNumber: true, status: true }}
            }
        });

        if(!updatedEnhancement) throw new BadRequestException("Failed to update enhancement!")

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
