import { ApiPropertyOptional } from "@nestjs/swagger";
import { ClaimStatus } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsArray, IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { PaginationDto } from "common/dto/pagination.dto"

export class FindAllInsuranceRequestDto extends PaginationDto {
    @ApiPropertyOptional({ example: "CLM-00001"})
    @IsOptional()
    @IsString()
    refNumber?: string;

    @ApiPropertyOptional({ example: "Dr Sanjay"})
    @IsOptional()
    @IsString()
    doctorName?: string;

    @ApiPropertyOptional({ example: "KOTAK"})
    @IsOptional()
    @IsString()
    insuranceCompany?: string;

    @ApiPropertyOptional({ example: "RAKSHA TPA"})
    @IsOptional()
    @IsString()
    tpaName?: string;

    @ApiPropertyOptional({ example: "Dr Sanjay"})
    @IsOptional()
    @IsString()
    assigneeName?: string;

    @ApiPropertyOptional({ example: "Andrew M"})
    @IsOptional()
    @IsString()
    patientName?: string;

    @ApiPropertyOptional({ 
        example: 'status=DRAFT&status=APPROVED OR status=DRAFT,APPROVED',
        description: 'Filter by multiple claim statuses',
        isArray: true,
        enum: ClaimStatus,
    })
    @IsOptional()
    @IsArray()
    @IsEnum(ClaimStatus, { each: true })
    @Transform(({ value }) => {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        return value.split(','); // For ?status=DRAFT,APPROVED
    })
    status?: ClaimStatus[];

    @ApiPropertyOptional({ example: "2025-07-24"})
    @IsOptional()
    @IsDateString()
    createdFrom?: string;

    @ApiPropertyOptional({ example: "2025-07-24"})
    @IsOptional()
    @IsDateString()
    createdTo?: string;
}