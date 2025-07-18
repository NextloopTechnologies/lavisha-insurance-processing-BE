import { Type } from "class-transformer"
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, ValidateIf } from "class-validator"

export class PaginationDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    skip?: number = 0;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(-50)
    @Max(50)
    @ValidateIf(o => o.take !== 0) //disallow 0
    take?: number = 10; 

    @IsOptional()
    @IsString()
    sortBy?: string;

    @IsOptional()
    @IsString()
    cursor?: string;

    @IsOptional()
    @IsEnum(['asc','desc'])
    sortOrder?: 'asc' | 'desc' = 'asc';
}