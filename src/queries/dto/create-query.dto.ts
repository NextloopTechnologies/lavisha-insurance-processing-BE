import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { DocumentType } from "@prisma/client";
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

export class CreateQueryDto {
    @ApiProperty({ example: 'claim-uuid' })
    @IsString()
    insuranceRequestId: string;

    @ApiPropertyOptional({ 
        example: 'enhancment-uuid',
        description: 'required when creating enhancement queries.'
    })
    @IsOptional()
    @IsString()
    enhancementId?: string;
        
    @ApiPropertyOptional({ example: 'Some notes...' })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiPropertyOptional({ example: 'Resolved remarks notes...' })
    @IsOptional()
    @IsString()
    resolvedRemarks?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    isResolved?: boolean;

    @ApiProperty({ type: [CreateDocumentInput] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateDocumentInput)
    documents: CreateDocumentInput[];
}
