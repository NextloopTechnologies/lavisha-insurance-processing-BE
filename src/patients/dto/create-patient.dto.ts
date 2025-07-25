import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";

export class CreatePatientDto{
    @ApiProperty({ example: 'John Doe' })
    @IsString()
    @MinLength(3)
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: 35 })
    @IsInt()
    age: number;

    @ApiPropertyOptional({ example: 'folder/lab_report.pdf' })
    @IsOptional()
    @IsString()
    fileName?: string;

    @ApiPropertyOptional({ example: 'https://files.example.com/folder/lab_report.pdf' })
    @IsOptional()
    @IsString()
    url?: string;
}