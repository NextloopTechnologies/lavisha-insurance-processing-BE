import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class CommonService {
    constructor(private prisma: PrismaService) {}

    async logActivity(
        userId: string,
        action: string,
        targetType: string,
        targetId: string
    ) {
        return this.prisma.activityLog.create({
            data: {
                userId,
                action,
                targetType,
                targetId,
            },
        });
    }

    async logInsuranceRequestChange(
        userId: string,
        insuranceRequestId: string,
        message: string
    ) {
        const [comment, notification, activityLog] = await this.prisma.$transaction([
            this.prisma.comment.create({
                data: {
                    text: message,
                    type: 'SYSTEM',
                    insuranceRequest: { connect: { id: insuranceRequestId }}, 
                    creator: { connect: { id: userId }}
                },
            }),
            this.prisma.notification.create({
                data: {
                    userId,
                    message,
                },
            }),
            this.prisma.activityLog.create({
                data: {
                    userId,
                    action: message,
                    targetType: 'InsuranceRequest',
                    targetId: insuranceRequestId,
                },
            }),
        ]);
    
        return { comment, notification, activityLog };
    }

}