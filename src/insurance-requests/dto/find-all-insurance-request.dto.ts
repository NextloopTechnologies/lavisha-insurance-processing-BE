import { ClaimStatus } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { PaginationDto } from "common/dto/pagination.dto"

export class FindAllInsuranceRequestDto extends PaginationDto {
    @IsOptional()
    @IsString()
    refNumber?: string;

    @IsOptional()
    @IsString()
    doctorName?: string;

    @IsOptional()
    @IsString()
    insuranceCompany?: string;

    @IsOptional()
    @IsString()
    tpaName?: string;

    @IsOptional()
    @IsString()
    assignedTo?: string;

    @IsOptional()
    @IsString()
    patientName?: string;

    @IsOptional()
    @IsEnum(ClaimStatus)
    status?: ClaimStatus;

    @IsOptional()
    @IsDateString()
    createdFrom?: string;

    @IsOptional()
    @IsDateString()
    createdTo?: string;
}