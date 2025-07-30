import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateQueryDto } from './dto/create-query.dto';
import { UpdateQueryDto } from './dto/update-query.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MutateQueryResponseDto } from './dto/mutate-query-response.dto';
import { Prisma } from '@prisma/client';
import { DocumentResponseDto } from 'src/insurance-requests/dto/mutate-response-insurance-requests.dto';

@Injectable()
export class QueriesService {

  constructor(private prisma: PrismaService) {}

  async create(
    data: CreateQueryDto,
    uploadedBy: string
  ): Promise<MutateQueryResponseDto> {
    const { insuranceRequestId, enhancementId, documents, ...rest } = data;
    const claim = await this.prisma.insuranceRequest.findUnique({ where: { id: insuranceRequestId } });
    if (!claim) throw new BadRequestException('Invalid claim ID');
    
    const createdQuery = await this.prisma.query.create({ 
      data : { 
        ...rest, 
        insuranceRequest: { connect: { id: insuranceRequestId }}
      },
      include: { 
        insuranceRequest: { select: { id: true, refNumber: true, status: true }}
      }
    });

    if(!createdQuery) throw new BadRequestException("Failed to create query!")
  
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

    return {
      id: createdQuery.id,
      refNumber: createdQuery.insuranceRequest.refNumber,
      notes: createdQuery.notes ? createdQuery.notes : undefined, 
      documents: createdDocuments
    }
  }
  
  async update(params: {
    where: Prisma.QueryWhereUniqueInput,
    data: UpdateQueryDto,
    uploadedBy: string
  }): Promise<MutateQueryResponseDto> {

    const { where, data, uploadedBy } = params;
    const { documents, insuranceRequestId, enhancementId, ...rest } = data;
    let updatedDocuments: DocumentResponseDto[] = []
    let createdDocuments: DocumentResponseDto[] = []

    const updatedQuery = await this.prisma.query.update({
      where,
      data: {
        ...rest
      },
      include: {
          insuranceRequest: { select: { id: true, refNumber: true, status: true }}
      }
    });

    if(!updatedQuery) throw new BadRequestException("Failed to update query!")

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
      id: updatedQuery.id,
      refNumber: updatedQuery.insuranceRequest.refNumber,
      notes: updatedQuery.notes ? updatedQuery.notes : undefined, 
      documents: documents?.length ? [...createdDocuments, ...updatedDocuments]: undefined
    };
  }
}
