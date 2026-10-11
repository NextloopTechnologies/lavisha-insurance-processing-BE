import { Injectable } from "@nestjs/common";
import { Role } from "@prisma/client";
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

    /**
     * Records a claim event: a SYSTEM line in the claim's chat (optional), an activity log entry,
     * and notifications for the other side of the claim. Recipients depend on who acted:
     * - admin side (SUPER_ADMIN / ADMIN) acted -> the claim's hospital and its managers
     * - hospital side (HOSPITAL / HOSPITAL_MANAGER) acted -> the assignee and every SUPER_ADMIN
     * The actor is never notified about their own action.
     */
    async notifyClaimEvent(params: {
        userId: string,
        insuranceRequestId: string,
        message: string,
        chat?: boolean,
        alsoNotify?: (string | null | undefined)[],
        includeSuperAdmins?: boolean,
    }) {
        const { userId, insuranceRequestId, message, chat = true, alsoNotify = [], includeSuperAdmins = false } = params

        const [claim, actor] = await Promise.all([
            this.prisma.insuranceRequest.findUnique({
                where: { id: insuranceRequestId },
                select: { assignedTo: true, patient: { select: { hospitalUserId: true } } },
            }),
            this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
        ])
        const hospitalId = claim?.patient?.hospitalUserId ?? null
        const recipients = await this.claimRecipients({
            actorRole: actor?.role,
            hospitalId,
            assignedTo: claim?.assignedTo ?? null,
            includeSuperAdmins,
        })
        const notifiedTo = [...new Set([...recipients, ...alsoNotify])].filter(
            (id): id is string => !!id && id !== userId,
        )

        await this.prisma.$transaction([
            ...(chat
                ? [this.prisma.comment.create({
                    data: {
                        text: message,
                        type: 'SYSTEM',
                        insuranceRequest: { connect: { id: insuranceRequestId } },
                        ...(hospitalId && { hospital: { connect: { id: hospitalId } } }),
                        creator: { connect: { id: userId } },
                        isRead: true,
                    },
                })]
                : []),
            this.prisma.activityLog.create({
                data: { userId, action: message, targetType: 'InsuranceRequest', targetId: insuranceRequestId },
            }),
            this.prisma.notification.createMany({
                data: notifiedTo.map((id) => ({ userId: id, message })),
            }),
        ])

        return { notifiedTo }
    }

    /** The other side of a claim, as seen from the actor's role. */
    async claimRecipients(params: {
        actorRole?: Role,
        hospitalId: string | null,
        assignedTo: string | null,
        includeSuperAdmins?: boolean,
    }): Promise<string[]> {
        const { actorRole, hospitalId, assignedTo, includeSuperAdmins } = params
        const adminActed = actorRole === Role.SUPER_ADMIN || actorRole === Role.ADMIN

        const ids: (string | null)[] = []
        if (adminActed && hospitalId) {
            const managers = await this.prisma.user.findMany({
                where: { role: Role.HOSPITAL_MANAGER, hospitalId },
                select: { id: true },
            })
            ids.push(hospitalId, ...managers.map((m) => m.id))
        }
        if (!adminActed) ids.push(assignedTo)
        if (!adminActed || includeSuperAdmins) {
            const superAdmins = await this.prisma.user.findMany({
                where: { role: Role.SUPER_ADMIN },
                select: { id: true },
            })
            ids.push(...superAdmins.map((u) => u.id))
        }
        return ids.filter((id): id is string => !!id)
    }

}
