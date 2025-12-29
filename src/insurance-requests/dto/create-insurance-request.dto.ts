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

    @ApiPropertyOptional({ example: 'Discharge summary...' })
    @IsOptional()
    @IsString()
    dischargeSummary?: string;

    @ApiPropertyOptional({ example: 'Settlement summary...' })
    @IsOptional()
    @IsString()
    settlementSummary?: string;

    @ApiPropertyOptional({
        example: '85000.50',
        description: ' or 85000 no comma separated like 8,500'
    })
    @IsOptional()
    @IsString()
    settlementAmount?: string;

    @ApiPropertyOptional({
        example: '85000.50',
        description: ' or 85000 no comma separated like 8,500'
    })
    @IsOptional()
    @IsString()
    actualQuotedAmount?: string;

    @ApiPropertyOptional({ example: '100000', description: 'Total bill amount' })
    @IsOptional()
    @IsString()
    totalBill?: string;

    @ApiPropertyOptional({ example: '80000', description: 'Total approved amount' })
    @IsOptional()
    @IsString()
    totalApproval?: string;

    @ApiPropertyOptional({ example: 'txn-123456789', description: 'Transaction ID' })
    @IsOptional()
    @IsString()
    transactionId?: string;

    @ApiPropertyOptional({ example: '500', description: 'Tax Deducted at Source (TDS)' })
    @IsOptional()
    @IsString()
    tds?: string;

    @ApiPropertyOptional({ example: '2000', description: 'Deduction amount' })
    @IsOptional()
    @IsString()
    deduction?: string;

    @ApiPropertyOptional({ example: '2023-10-01', description: 'Settlement date' })
    @IsOptional()
    @IsString() // You could also use Date if you need Date validation
    settlementDate?: string;

    @ApiPropertyOptional({ example: '2023-10-02', description: 'Date when the settlement was last updated' })
    @IsOptional()
    @IsString() // You could also use Date if you need Date validation
    updatedSettlementDate?: string;

    @ApiPropertyOptional({
        example: true,
        description: 'this is needed when unassigned claim needs a basic update when triggered from pencil edit icon on DRAFT and PENDING status'
    })

    @IsOptional()
    @IsBoolean()
    isBasicClaimUpdate?: boolean;

    @ApiProperty({ type: [CreateDocumentInput] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateDocumentInput)
    documents: CreateDocumentInput[];
}
