import { IsInt, IsNotEmpty, IsString, MinLength } from "class-validator";

export class CreatePatientDto{
    @IsString()
    @MinLength(3)
    @IsNotEmpty()
    name: string;

    @IsInt()
    age: number;
}