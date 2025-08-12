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

    async logInsuranceRequestChange(params:{
        userId: string,
        notifiedTo: string,
        insuranceRequestId: string,
        message: string
    }) {
        const { userId, notifiedTo, insuranceRequestId, message } = params
        const [comment, activityLog] = await this.prisma.$transaction([
            this.prisma.comment.create({
                data: {
                    text: message,
                    type: 'SYSTEM',
                    insuranceRequest: { connect: { id: insuranceRequestId }}, 
                    creator: { connect: { id: userId }}
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

        const notification = await this.prisma.notification.create({
            data: {
                user: { connect: { id: notifiedTo }},
                message,
            },
        })
    
        return { comment, notification, activityLog };
    }

    async logInsuranceRequestNotification(params:{
        userId: string,
        notifiedTo: string,
        insuranceRequestId: string,
        message: string
    }) {
        const { userId, notifiedTo, insuranceRequestId, message } = params

        const notification = await this.prisma.notification.create({
            data: {
                userId: notifiedTo,
                message,
            },
        })

        const activityLog = await this.logActivity(
            userId,
            message,
            'InsuranceRequest',
            insuranceRequestId   
        )
    
        return { notification, activityLog };
    }

}