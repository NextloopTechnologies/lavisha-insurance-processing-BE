import { DocumentType } from "@prisma/client"
import { Type } from "class-transformer"
import { IsArray, IsEnum, IsString, ValidateNested } from "class-validator"

class DocumentResponseDto {
    @IsString()
    id: string

    @IsString()
    insuranceRequestId: string

    @IsString()
    fileName: string

    @IsEnum(DocumentType)
    type: DocumentType
}

export class MutateResponseInsuranceRequestDto {
    @IsString()
    id: string

    @IsString()
    refNumber:string

    @IsString()
    doctorName: string

    @IsString()
    tpaName: string

    @IsString()
    insuranceCompany: string

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DocumentResponseDto)
    documents: DocumentResponseDto[]
}