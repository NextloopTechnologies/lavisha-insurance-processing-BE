import { ClaimStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class CreateInsuranceRequestDto {
    @IsString()
    patientId: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsString()
    doctorName: string;

    @IsString()
    tpaName: string;

    @IsString()
    insuranceCompany: string;

    @IsOptional()
    @IsString()
    assignedTo?: string;

    @IsOptional()
    @IsEnum(ClaimStatus)
    status?: ClaimStatus;

    @IsOptional()
    @IsString()
    additionalNotes?: string;
}
