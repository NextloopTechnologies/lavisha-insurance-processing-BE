import { CommentType } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class CreateCommentsDto {
    @IsString()
    text: string;

    @IsEnum(CommentType)
    type: CommentType;

    @IsString()
    insuranceRequestId: string;
        
    @IsOptional()
    @IsString()
    fileUrl?: string;
}