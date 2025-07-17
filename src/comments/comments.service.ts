import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCommentsDto } from './dto/create-comments.dto';
import { Comment, CommentType, Prisma } from '@prisma/client';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';

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
        skip?: number;
        take?: number;
        where?: Prisma.CommentWhereInput;
        orderBy?: Prisma.CommentOrderByWithRelationInput;
    }): Promise<PaginatedResult<Comment>> {
        const { skip, take, where, orderBy } = params;
        const [total, data] = await this.prisma.$transaction([
            this.prisma.comment.count({ where }),
            this.prisma.comment.findMany({
                skip,
                take,
                where,
                orderBy,
                include: {
                    creator: { select: { id: true, name: true } },
                },
            })
        ]);
        return { total, data };
    }
}
