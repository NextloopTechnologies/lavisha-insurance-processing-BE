import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBooleanString, IsOptional } from "class-validator";
import { PaginationDto } from "common/dto/pagination.dto";

export class FindAllNotificationsDto extends PaginationDto{
    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBooleanString()
    isRead?: string;
}
