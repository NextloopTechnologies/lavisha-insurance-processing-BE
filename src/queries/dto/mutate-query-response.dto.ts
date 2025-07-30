import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Type } from "class-transformer"
import { IsArray, IsOptional, IsString, ValidateNested } from "class-validator"
import { DocumentResponseDto } from "src/insurance-requests/dto/mutate-response-insurance-requests.dto"

export class MutateQueryResponseDto {
    @ApiProperty({ example: 'enhancement-uuid'})
    @IsString()
    id: string;

    @ApiProperty({ example: 'CLM-00004'})
    @IsString()
    refNumber: string;

    @ApiPropertyOptional({ example: 'some descp of notes'})
    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DocumentResponseDto)
    documents?: DocumentResponseDto[];
}