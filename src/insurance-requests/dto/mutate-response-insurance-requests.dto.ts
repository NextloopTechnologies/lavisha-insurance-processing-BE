import { ApiProperty } from "@nestjs/swagger"
import { DocumentType } from "@prisma/client"
import { Type } from "class-transformer"
import { IsArray, IsEnum, IsOptional, IsString, ValidateNested } from "class-validator"

export class DocumentResponseDto {
    @ApiProperty({ example: 'doc-uuid'})
    @IsString()
    id: string

    @ApiProperty({ example: 'insuranceRequest-uuid'})
    @IsString()
    insuranceRequestId: string

    @ApiProperty({ example: 'folder/fileName.pdf'})
    @IsString()
    fileName: string

    @ApiProperty({ example: DocumentType.ICP })
    @IsEnum(DocumentType)
    type: DocumentType
}

export class MutateResponseInsuranceRequestDto {
    @ApiProperty({ example: 'insurance-uuid'})
    @IsString()
    id: string

    @ApiProperty({ example: 'CML-00001'})
    @IsString()
    refNumber:string

    @ApiProperty({ example: 'John Doe'})
    @IsString()
    doctorName: string

    @ApiProperty({ example: 'RAKSHA_TPA'})
    @IsString()
    tpaName: string

    @ApiProperty({ example: 'KOTAK'})
    @IsString()
    insuranceCompany: string

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DocumentResponseDto)
    documents?: DocumentResponseDto[]
}