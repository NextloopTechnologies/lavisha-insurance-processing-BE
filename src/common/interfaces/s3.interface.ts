import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export interface S3FileUploadResult {
    key: string;
    url? : string
}   

export class S3FileUploadResultDto {
    @ApiProperty({ example: "folder/fileName.pdf"})
    @IsString()
    key: string

    @ApiPropertyOptional({ example: "https://example.com/folder/fileName.pdf" })
    @IsOptional()
    @IsString()
    url?: string
}