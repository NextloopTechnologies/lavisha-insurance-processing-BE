import { IsInt, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";

export class CreatePatientDto{
    @IsString()
    @MinLength(3)
    @IsNotEmpty()
    name: string;

    @IsInt()
    age: number;

    @IsOptional()
    @IsString()
    fileName?: string;

    @IsOptional()
    @IsString()
    url?: string;
}