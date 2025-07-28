import { ApiProperty } from "@nestjs/swagger";
import { CommentType } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class CreateCommentsDto {
    @ApiProperty({ example: 'comments-uuid'})
    @IsString()
    text: string;

    @ApiProperty({ example: CommentType.QUERY })
    @IsEnum(CommentType)
    type: CommentType;

    @ApiProperty({ example: 'insuranceRequest-uuid'})
    @IsString()
    insuranceRequestId: string;
        
    @ApiProperty({ example: 'https://example.com/folder/fileName.pdf'})
    @IsOptional()
    @IsString()
    fileUrl?: string;
}