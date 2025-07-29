import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { ClaimStatus } from "@prisma/client"
import { Type } from "class-transformer"
import { IsArray, IsEnum, IsInt, IsOptional, IsString, ValidateNested } from "class-validator"
import { DocumentResponseDto } from "src/insurance-requests/dto/mutate-response-insurance-requests.dto"

export class MutateEnhancementsResponseDto {
    @ApiProperty({ example: 'enhancement-uuid'})
    @IsString()
    id: string;

    @ApiProperty({ example: 'CLM-00004'})
    @IsString()
    refNumber: string;

    @ApiProperty({ example: 'insurance-uuid'})
    @IsInt()
    numberofDays: number;

    @ApiPropertyOptional({ enum: ClaimStatus, example: ClaimStatus.SENT_TO_TPA })
    @IsOptional()
    @IsEnum(ClaimStatus)
    status: ClaimStatus;

    @ApiPropertyOptional({ example: 'some descp of notes'})
    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DocumentResponseDto)
    documents?: DocumentResponseDto[];
}