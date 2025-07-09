import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString } from "class-validator";
import { PaginationDto } from "common/dto/pagination.dto"

export class FindAllPatientDto extends PaginationDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    age? : number;
}