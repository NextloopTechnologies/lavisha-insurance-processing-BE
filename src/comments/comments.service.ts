import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCommentsDto } from './dto/create-comments.dto';
import { Comment, CommentType, Prisma } from '@prisma/client';

@Injectable()
export class CommentsService {
    constructor(private prisma: PrismaService) {}
    
     async create(data: CreateCommentsDto, createdBy: string): Promise<Comment> {
        const { insuranceRequestId, ...rest } = data;
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
            insuranceRequest: { connect: { id: insuranceRequestId }}, 
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
}
