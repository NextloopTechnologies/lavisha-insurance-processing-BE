import { ClaimStatus, DocumentType } from "@prisma/client";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from "class-validator";

class CreateDocumentInput {
    @IsString()
    @IsOptional()
    id?: string;

    @IsString()
    fileName: string;

    @IsEnum(DocumentType)
    type: DocumentType;
        
    @IsOptional()
    @IsString()
    remark?: string;
}

export class CreateInsuranceRequestDto {
    @IsString()
    patientId: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    isPreAuth?: boolean;

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

    @IsOptional()
    @IsString()
    dischargeSummary?: string;

    @IsOptional()
    @IsString()
    settlementSummary?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateDocumentInput)
    documents: CreateDocumentInput[];
}
