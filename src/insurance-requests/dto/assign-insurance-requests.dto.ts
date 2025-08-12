import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class AddAssigneeInsuranceRequestDto {
    @ApiProperty({ example: 'assignee-uuid' })
    @IsString()
    assignedTo: string;
}