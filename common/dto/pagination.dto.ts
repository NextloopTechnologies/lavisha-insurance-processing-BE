import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer"
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, ValidateIf } from "class-validator"

export class PaginationDto {
    @ApiPropertyOptional({ example: 0, minimum: 0 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    skip?: number = 0;

    @ApiPropertyOptional({ example: 10, minimum: -50, maximum: 50 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(-50)
    @Max(50)
    @ValidateIf(o => o.take !== 0) //disallow 0
    take?: number = 10; 

    @ApiPropertyOptional({ example: 'name' })
    @IsOptional()
    @IsString()
    sortBy?: string;

    @ApiPropertyOptional({ example: 'last-uuid' })
    @IsOptional()
    @IsString()
    cursor?: string;

    @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
    @IsOptional()
    @IsEnum(['asc','desc'])
    sortOrder?: 'asc' | 'desc' = 'desc';
}