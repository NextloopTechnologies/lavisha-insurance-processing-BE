import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsString } from "class-validator"

export class ResponseNotificationDto {
    @ApiProperty({ example: 'notification-uuid' })
    @IsString()
    id: string;

    @ApiProperty({ example: 'user-uuid' })
    @IsString()
    userId: string;

    @ApiProperty({ example: 'message....' })
    @IsString()
    message: string;

    @ApiProperty({ example: true })
    @IsBoolean()
    isRead: boolean;

    @ApiProperty({ example: "2025-07-31T14:43:15.761Z"})
    createdAt: Date
}