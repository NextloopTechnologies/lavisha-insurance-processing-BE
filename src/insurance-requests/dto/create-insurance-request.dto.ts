import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ClaimStatus, DocumentType } from "@prisma/client";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from "class-validator";

class CreateDocumentInput {
    @ApiPropertyOptional({ example: 'doc-uuid' })
    @IsString()
    @IsOptional()
    id?: string;

    @ApiProperty({ example: 'folder/report.pdf' })
    @IsString()
    fileName: string;

    @ApiProperty({ enum: DocumentType, example: DocumentType.CLINIC_PAPER })
    @IsEnum(DocumentType)
    type: DocumentType;
    
    @ApiPropertyOptional({ example: 'Final Bill...' })
    @IsOptional()
    @IsString()
    remark?: string;
}

export class CreateInsuranceRequestDto {
    @ApiProperty({ example: 'patient-uuid' })
    @IsString()
    patientId: string;

    @ApiPropertyOptional({ example: 'Some description...' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    isPreAuth?: boolean;

    @ApiProperty({ example: 'Dr. John Smith' })
    @IsString()
    doctorName: string;

    @ApiProperty({ example: 'RAKSHA_TPA' })
    @IsString()
    tpaName: string;

    @ApiProperty({ example: 'KOTAK' })
    @IsString()
    insuranceCompany: string;

    @ApiProperty({ example: 'assigned-to-uuid' })
    @IsOptional()
    @IsString()
    assignedTo?: string;

    @ApiPropertyOptional({ enum: ClaimStatus, example: ClaimStatus.SENT_TO_TPA })
    @IsOptional()
    @IsEnum(ClaimStatus)
    status?: ClaimStatus;

    @ApiPropertyOptional({ example: "Some notes..."})
    @IsOptional()
    @IsString()
    additionalNotes?: string;

    @ApiProperty({ type: [CreateDocumentInput] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateDocumentInput)
    documents: CreateDocumentInput[];
}
