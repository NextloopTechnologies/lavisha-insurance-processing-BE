import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ClaimStatus, DocumentType } from "@prisma/client";
import { Type } from "class-transformer";
import { IsArray, IsEnum, IsIn, IsInt, IsOptional, IsString, ValidateNested } from "class-validator";

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

export class CreateEnhancementDto {
    @ApiProperty({ example: 'claim-uuid' })
    @IsString()
    insuranceRequestId: string;
    
    @ApiProperty({ example: 4 })
    @IsInt()
    numberOfDays: number;
    
    @ApiPropertyOptional({ example: 'Dr. John Smith' })
    @IsOptional()
    @IsString()
    doctorName?: string;
    
    @ApiPropertyOptional({ example: 'Some notes...' })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiPropertyOptional({ 
        enum: ClaimStatus, 
        example: ClaimStatus.SENT_TO_TPA, 
        description: 'PENDING is by default and does not need to add as a status in payload.' 
    })
    @IsOptional()
    @IsEnum(ClaimStatus)
    @IsIn([
        ClaimStatus.SENT_TO_TPA,
        ClaimStatus.QUERIED,
        ClaimStatus.APPROVED,
        ClaimStatus.DENIED,
    ], { message: `${[ClaimStatus.SENT_TO_TPA,ClaimStatus.QUERIED,ClaimStatus.APPROVED, ClaimStatus.DENIED]} are allowed!` })
    status?: ClaimStatus;

    @ApiPropertyOptional({ example: 'Discharge summary...' })
    @IsOptional()
    @IsString()
    dischargeSummary?: string;

    @ApiPropertyOptional({ example: 'Settlement summary...' })
    @IsOptional()
    @IsString()
    settlementSummary?: string;

    @ApiProperty({ type: [CreateDocumentInput] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateDocumentInput)
    documents: CreateDocumentInput[];
}
