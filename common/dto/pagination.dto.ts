import { Type } from "class-transformer"
import { IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator"

export class PaginationDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    skip?: number = 0;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    take?: number = 10; 

    @IsOptional()
    @IsString()
    sortBy?: string;

    @IsOptional()
    @IsEnum(['asc','desc'])
    sortOrder?: 'asc' | 'desc' = 'asc';
}