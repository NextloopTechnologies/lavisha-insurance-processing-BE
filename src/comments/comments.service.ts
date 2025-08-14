import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCommentsDto } from './dto/create-comments.dto';
import { Comment, CommentType, Prisma, Role } from '@prisma/client';

@Injectable()
export class CommentsService {
    constructor(private prisma: PrismaService) {}
    
     async create(
        role: string,
        data: CreateCommentsDto, 
        createdBy: string
    ): Promise<Comment> {
        const { insuranceRequestId, hospitalId, ...rest } = data;
        if(role === Role.HOSPITAL && data.type===CommentType.HOSPITAL_NOTE) {
            throw new BadRequestException(`Role ${role} can't post manager comments`)
        }
        if(insuranceRequestId && hospitalId) {
            throw new BadRequestException("insuranceRequestId and hospitalId both can't be used at same time.")
        }
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
            ...(insuranceRequestId && { isRead: true }),
            creator: { connect: { id: createdBy }} 
          }
        });
      }
    
    async findAll(params: {
        take?: number;
        cursor?: string;
        where?: Prisma.CommentWhereInput;
        currentUserId: string,
        role: Role,
        loggedInUserHospitalId: string
    }): Promise<Comment[]> {
        const { cursor, take, where, currentUserId, role, loggedInUserHospitalId } = params;
        const comments = this.prisma.comment.findMany({
            take,
            ...(cursor && { cursor: { id: cursor }, skip: 1 }),
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                creator: { select: { id: true, name: true, profileUrl: true } },
            },
        })
        if (role === Role.HOSPITAL_MANAGER && loggedInUserHospitalId) {
            await this.prisma.comment.updateMany({
                where: {
                    hospitalId: loggedInUserHospitalId,
                    isRead: false,
                    createdBy: { not: currentUserId },
                },
                data: { isRead: true },
            });
        }

        return comments
    }

    async markRead(hospitalId: string, currentUserId: string) {
        return await this.prisma.comment.updateMany({
            where: {
                hospitalId,
                isRead: false,
                createdBy: { not: currentUserId },
            },
            data: { isRead: true },
        });
    }


    async listHospitalsWithManagerComments() {
        const latestComments: Comment[] = await this.prisma.$queryRaw`
            SELECT DISTINCT ON ("hospitalId") c."id", c."text", c."type", c."hospitalId", c."createdAt",
                    h."name" as "hospitalName",
                    u."name" as "creatorName"
            FROM "Comment" c
            LEFT JOIN "User" h ON h."id" = c."hospitalId"
            LEFT JOIN "User" u ON u."id" = c."createdBy"
            WHERE c."type" = 'HOSPITAL_NOTE'
            ORDER BY c."hospitalId", c."createdAt" DESC
        `;
        // make global sorting desc for comment list
        return latestComments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        // Get latest comment timestamp per hospital
        // const latestPerHospital = await this.prisma.comment.groupBy({
        //     by: ['hospitalId'],
        //     where: { type: 'HOSPITAL_NOTE' },
        //     _max: { createdAt: true }
        // });
        // return await this.prisma.comment.findMany({
        //     where: {
        //         type: 'HOSPITAL_NOTE',
        //         OR: latestPerHospital.map(l => ({
        //         hospitalId: l.hospitalId,
        //         createdAt: l._max.createdAt
        //         }))
        //     },
        //     select: {
        //         id: true,
        //         text: true,
        //         type: true,
        //         hospitalId: true,
        //         hospital: { select: { id: true, name: true }},
        //         creator: { select: { id: true, name: true }}
        //     },
        //     orderBy: { createdAt: 'desc' }
        // });

    }
}
