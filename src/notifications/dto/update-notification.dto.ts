import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsBoolean, IsOptional, IsUUID, ValidateIf } from "class-validator";

export class UpdateNotificationDto {
    @ApiProperty({ example: true })
    @IsBoolean()
    markAllRead: boolean;

    @ApiPropertyOptional({ example: ['notif-uuid-1', 'notif-uuid-2'] })
    @ValidateIf(o => o.markAllRead === false)
    @IsArray()
    @ArrayNotEmpty()
    @IsUUID('4', { each: true })
    batchRead?: string[];
}
