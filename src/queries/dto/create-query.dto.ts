import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { DocumentType } from "@prisma/client";
import { Type } from "class-transformer";
import { IsArray, IsEnum, IsOptional, IsString, ValidateNested } from "class-validator";

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

    @ApiPropertyOptional({ example: 'enhancment-uuid' })
    @IsOptional()
    @IsString()
    enhancementId?: string;
        
    @ApiPropertyOptional({ example: 'Some notes...' })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiProperty({ type: [CreateDocumentInput] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateDocumentInput)
    documents: CreateDocumentInput[];
}
