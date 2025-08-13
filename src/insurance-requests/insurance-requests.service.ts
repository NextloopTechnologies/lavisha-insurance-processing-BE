import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateInsuranceRequestDto } from './dto/create-insurance-request.dto';
import { UpdateInsuranceRequestDto } from './dto/update-insurance-request.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Document, InsuranceRequest, Prisma, Role } from '@prisma/client';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { DocumentResponseDto, MutateResponseInsuranceRequestDto } from './dto/mutate-response-insurance-requests.dto';
import { FileService } from 'src/file/file.service';
import { CommonService } from 'src/common/common.service';
import { AddAssigneeInsuranceRequestDto } from './dto/assign-insurance-requests.dto';

@Injectable()
export class InsuranceRequestsService {

  constructor(
    private prisma: PrismaService,
    private fileService: FileService,
    private readonly commonService: CommonService
  ) {}

  private async generateClaimRefNumber(): Promise<string> {
    const lastClaim = await this.prisma.insuranceRequest.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { refNumber: true },
      where: { refNumber: { startsWith: 'CLM-' } },
    });
    const lastNumber = lastClaim?.refNumber?.split('-')[1];
    const next = lastNumber ? parseInt(lastNumber) + 1 : 1;
    return `CLM-${String(next).padStart(5, '0')}`;
  }

  async create(
    data: CreateInsuranceRequestDto,
    uploadedBy: string,
    userName: string
  ): Promise<MutateResponseInsuranceRequestDto> {
    const { patientId, assignedTo, documents, ...rest } = data;
    
    // notification to superadmin or default larisha admin  along with activity
    const isSuperAdminExists = await this.prisma.user.findFirst({ 
      where: { role: Role.SUPER_ADMIN },
      select: { id: true }
    })
    if (!isSuperAdminExists) throw new BadRequestException("No SuperAdmin found!")

    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new BadRequestException('Invalid patient ID');

    const refNumber = await this.generateClaimRefNumber();
   
    const createdClaim = await this.prisma.insuranceRequest.create({ 
      data : { 
        ...rest,
        // ...(assignedTo && { user: { connect: { id: assignedTo } } }),
        patient: { connect: { id: patientId }}, 
        refNumber 
      },
      include: { 
        patient: { select: { id: true, name: true }}
      }
    });

    if(!createdClaim) throw new BadRequestException("Failed to create claim!")

    // notify to super admin
    await this.commonService.logInsuranceRequestNotification({
      userId: uploadedBy,
      notifiedTo: isSuperAdminExists.id,
      insuranceRequestId: createdClaim.id,
      message: `${userName} created claim ${refNumber}`
    })
  
    const createdDocuments = await this.prisma.document.createManyAndReturn({
      data: documents.map((document) => ({
        ...document,
        uploadedBy,
        insuranceRequestId: createdClaim.id,
        remark: document.remark ? document.remark : undefined
      })),
      select: { id: true , insuranceRequestId: true , fileName: true , type: true }
    })

    if(!createdDocuments.length) throw new BadRequestException("Failed to create documents!")

    await this.commonService.logInsuranceRequestChange({
      userId: uploadedBy,
      notifiedTo: isSuperAdminExists.id,
      insuranceRequestId: createdClaim.id,
      message: `${userName} uploaded ${createdDocuments.length} document(s) for ${refNumber}`,
    });
  
    return {
      id: createdClaim.id,
      refNumber: createdClaim.refNumber,
      doctorName: createdClaim.doctorName,
      tpaName: createdClaim.tpaName,
      insuranceCompany: createdClaim.insuranceCompany,
      documents: createdDocuments
    }
  }

  async findAll(params: {
      skip?: number;
      take?: number;
      where?: Prisma.InsuranceRequestWhereInput;
      orderBy?: Prisma.InsuranceRequestOrderByWithRelationInput;
    }): Promise<PaginatedResult<InsuranceRequest>> {
      const { skip, take, where, orderBy } = params;
      const [total, data] = await this.prisma.$transaction([
        this.prisma.insuranceRequest.count( { where}),
        this.prisma.insuranceRequest.findMany({
          skip,
          take,
          where,
          orderBy,
          include: {
            patient: { select: { id: true, name: true }}
          }
        })
      ])
      return { total, data } 
    }
  
    async addPresignedUrls(docs: Document[]) {
      return await Promise.all(
        docs.map(async (doc) => ({
          ...doc,
          url: await this.fileService.getPresignedUrl(doc.fileName)
        }))
      );
    }

    async findOne(
      insuranceRequestWhereUniqueInput: Prisma.InsuranceRequestWhereUniqueInput
    ) : Promise<InsuranceRequest | null> {
      const insuranceRequest = await this.prisma.insuranceRequest.findUniqueOrThrow({
        where: insuranceRequestWhereUniqueInput,
        include: {
          patient: { select: { id: true, name: true } },
          documents: true,
          queries: { include: { documents: true }},
          enhancements: { include: { documents: true }}
        },
      });

      if (insuranceRequest.documents?.length > 0) {
        //keep only main claim documents and remove query,enhancements 
        insuranceRequest.documents = insuranceRequest.documents.filter(
          (doc) => !doc.enhancementId && !doc.queryId
        );
        insuranceRequest.documents = await this.addPresignedUrls(insuranceRequest.documents)
      }

      // Separate enhancement-linked queries from top-level ones
      const enhancementQueryMap = new Map<string, any[]>();

      if (insuranceRequest.queries.length > 0) {
        //keep only main claim queries and remove enhancements  
        insuranceRequest.queries = insuranceRequest.queries.filter((query) => {
          if (query.enhancementId) {
            const arr = enhancementQueryMap.get(query.enhancementId) || [];
            arr.push(query);
            enhancementQueryMap.set(query.enhancementId, arr);
            return false; // remove from top-level
          }
          return true; // keep in top-level
        });

        for (const query of insuranceRequest.queries) {
          if (query.documents.length > 0) {
            query.documents = await this.addPresignedUrls(query.documents)
          }
        }
      }

      if (insuranceRequest.enhancements.length > 0) {
        for (const enhancement of insuranceRequest.enhancements) {
          if (enhancement.documents.length > 0) {
            //filter query from enhancement documents
            enhancement.documents = enhancement.documents.filter(
              (doc) => !doc.queryId
            );
            enhancement.documents = await this.addPresignedUrls(enhancement.documents)
          }

          // Attach enhancement-specific queries
          const queries = enhancementQueryMap.get(enhancement.id) || [];
          for (const query of queries) {
            if (query.documents.length > 0) {
              query.documents = await this.addPresignedUrls(query.documents);
            }
          }

          // Inject the queries under each enhancement
          (enhancement as any).queries = queries;
        }
      }
      return insuranceRequest;
    }

    async assignClaim(params: {
      where: Prisma.InsuranceRequestWhereUniqueInput,
      data: AddAssigneeInsuranceRequestDto,
      userId: string,
      userName: string
    }): Promise<Partial<InsuranceRequest>> {
      const { where, data, userId, userName } = params
      const { assignedTo: assigneeId } = data

      const result = await this.prisma.insuranceRequest.update({
        where,
        data: {
          user: { connect: { id: assigneeId }}
        },
        select: { id: true, refNumber: true, assignedTo: true, user: { select: { id: true, name: true }} }
      })
      if(result) { 
        await this.commonService.logInsuranceRequestNotification({
          userId, 
          notifiedTo: assigneeId,
          insuranceRequestId: result.id,
          message: `${userName} has assigned ${result.refNumber} to ${result.user.name}.`
        })
      }
      const { id, refNumber, assignedTo } = result
      return { 
        id,
        refNumber,
        assignedTo
      }
    }
    
    async update(params: {
      where: Prisma.InsuranceRequestWhereUniqueInput,
      data: UpdateInsuranceRequestDto,
      uploadedBy: string,
      userName: string
    }): Promise<MutateResponseInsuranceRequestDto> {
  
      const { where, data, uploadedBy, userName } = params;
      const { patientId, assignedTo, documents, ...rest } = data;
      let updatedDocuments: DocumentResponseDto[] = []
      let createdDocuments: DocumentResponseDto[] = []
      let assigneeId: string;

      const claimExists = await this.prisma.insuranceRequest.findUnique({ 
        where ,
        select: { id: true, assignedTo: true, status: true } 
      })
      if(!claimExists) throw new BadRequestException('Invalid claim ID');
      if(!claimExists.assignedTo) throw new BadRequestException('Assign User first!');
      assigneeId = claimExists.assignedTo

      if (patientId) {
        const patient = await this.prisma.patient.findUnique({
          where: { id: patientId }, 
          select: { id: true } 
        });
        if (!patient) throw new BadRequestException('Invalid patient ID');
      }

      const updatedClaim = await this.prisma.insuranceRequest.update({
        where,
        data: {
          ...rest,
          // ...(assignedTo && { user: { connect: { id: assignedTo } } }),
          ...(patientId && { patient: { connect: { id: patientId } } })
        },
        include: {
          patient: { select: { id: true, name: true }},
        },
      });

      if(!updatedClaim) throw new BadRequestException("Failed to update claim!")

      await this.commonService.logActivity(
        uploadedBy,
        `${userName} updated claim ${updatedClaim.refNumber}`,
        "InsuranceRequest",
        updatedClaim.id,
      );

      if(data.status && claimExists.status !== data.status){
        await this.commonService.logInsuranceRequestChange({
          userId: uploadedBy,
          notifiedTo: assigneeId,
          insuranceRequestId: claimExists.id,
          message: `${userName} updated status from ${claimExists.status} to ${data.status} for ${updatedClaim.refNumber}`,
        });
      }

      if(documents?.length){
        const newDocs = documents.filter(doc => !doc.id);
        const existingDocs = documents.filter(doc => doc.id);
  
        if(newDocs?.length){
          createdDocuments = await this.prisma.document.createManyAndReturn({
            data: newDocs.map((document) => ({
              ...document,
              uploadedBy,
              insuranceRequestId: updatedClaim.id,
              remark: document.remark ? document.remark : undefined
            })),
            select: { id: true , insuranceRequestId: true , fileName: true , type: true }
          })
      
          if(!createdDocuments.length) throw new BadRequestException("Failed to create documents!")
          
          await this.commonService.logInsuranceRequestChange({
            userId: uploadedBy,
            notifiedTo: assigneeId,
            insuranceRequestId: updatedClaim.id,
            message:`${userName} added ${createdDocuments.length} document(s) for ${updatedClaim.refNumber}`,
          });
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
                select: { id: true , insuranceRequestId: true , fileName: true , type: true }
              });
            })
          );
          if(!updatedDocuments.length) throw new BadRequestException("Failed to update documents!")

          await this.commonService.logInsuranceRequestChange({
            userId: uploadedBy,
            notifiedTo: assigneeId,
            insuranceRequestId: updatedClaim.id,
            message:`${userName} modified ${updatedDocuments.length} document(s) for ${updatedClaim.refNumber}`,
          });
        }
      }

      return {
        id: updatedClaim.id,
        refNumber: updatedClaim.refNumber,
        doctorName: updatedClaim.doctorName,
        tpaName: updatedClaim.tpaName,
        insuranceCompany: updatedClaim.insuranceCompany,
        documents: documents?.length ? [...createdDocuments, ...updatedDocuments]: undefined
      };
    }
  
    async remove(refNumber: string): Promise<InsuranceRequest>{
      return await this.prisma.insuranceRequest.delete({
        where: { refNumber }
      })
    }
}
