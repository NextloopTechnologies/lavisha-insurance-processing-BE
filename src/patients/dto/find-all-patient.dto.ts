import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString } from "class-validator";
import { PaginationDto } from "common/dto/pagination.dto"

export class FindAllPatientDto extends PaginationDto {
    @ApiPropertyOptional({ example: "Sam" })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ example: 24 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    age? : number;

    @ApiPropertyOptional({ example: 'hospital-uuid' })
    @IsOptional()
    @IsString()
    hospitalId?: string;
}