import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCommentsDto } from './dto/create-comments.dto';
import { Comment, CommentType, Prisma } from '@prisma/client';

@Injectable()
export class CommentsService {
    constructor(private prisma: PrismaService) {}
    
     async create(data: CreateCommentsDto, createdBy: string): Promise<Comment> {
        const { insuranceRequestId, hospitalId, ...rest } = data;
        if(rest.type === CommentType.NOTE || 
        rest.type === CommentType.QUERY || 
        rest.type === CommentType.TPA_REPLY) {
            const insuranceRequest = await this.prisma.insuranceRequest.findUnique({ 
                where: { id: insuranceRequestId } 
            });
            if (!insuranceRequest) throw new BadRequestException('Invalid claim ID');
        }
       
        return await this.prisma.comment.create({ 
          data : { 
            ...rest, 
            ...(hospitalId ? { hospital: { connect: { id: hospitalId }}} : undefined), 
            ...(insuranceRequestId ? { insuranceRequest: { connect: { id: insuranceRequestId }}} : undefined), 
            creator: { connect: { id: createdBy }} 
          }
        });
      }
    
    async findAll(params: {
        take?: number;
        cursor?: string;
        where?: Prisma.CommentWhereInput;
    }): Promise<Comment[]> {
        const { cursor, take, where } = params;
        return await this.prisma.comment.findMany({
            take,
            ...(cursor && { cursor: { id: cursor }, skip: 1 }),
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                creator: { select: { id: true, name: true } },
            },
        })
    }

    async listHospitalsWithManagerComments() {
        return await this.prisma.user.findMany({
            where: { 
                role: 'HOSPITAL' ,
                managers: {
                    some: {
                        comments: {
                            some: { type: 'HOSPITAL_NOTE' }
                        }
                    }
                }
            },
            select: {
                id: true,
                name: true,
                managers: {
                    select: {
                        id: true,
                        name: true,
                        hospital: {
                            select : { id: true, name: true }
                        },
                        comments: {
                            where: { type: 'HOSPITAL_NOTE' },
                            orderBy: { createdAt: 'desc' },
                            take: 1, // latest comment
                            select: { createdAt: true }
                        }
                    }
                }
            }
        });
    }
}
