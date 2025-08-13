import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CommentType } from "@prisma/client";
import { IsEnum, IsIn, IsOptional, IsString, ValidateIf } from "class-validator";

export class CreateCommentsDto {
    @ApiProperty({ example: 'comments-uuid'})
    @IsString()
    text: string;

    @ApiProperty({ 
        example: CommentType.QUERY,
        enum: CommentType,
        description: 'SYSTEM is excluded from API-created comments', 
    })
    @IsEnum(CommentType)
    @IsIn([
        CommentType.NOTE,
        CommentType.QUERY,
        CommentType.TPA_REPLY,
        CommentType.HOSPITAL_NOTE,
    ], { message: 'SYSTEM comments cannot be created manually' })
    type: CommentType;

    @ApiProperty({ 
        example: 'insuranceRequest-uuid', 
        required: false,
        description: 'Required for claim based commenttypes NOTE, TPA_REPLY, QUERY'
    })
    @ValidateIf(o => o.type !== CommentType.HOSPITAL_NOTE)
    @IsString({ 
        message: 'insuranceRequestId must be provided unless type is HOSPITAL_NOTE' 
    })
    insuranceRequestId?: string;
    
    // @ApiProperty({ example: 'insuranceRequest-uuid'})
    // @IsString()
    // insuranceRequestId: string;
    @ApiProperty({ 
        example: 'hospital-uuid', 
        required: false,
        description: 'Required if type is HOSPITAL_NOTE'
    })
    @ValidateIf(o => o.type === CommentType.HOSPITAL_NOTE)
    @IsString({ message: 'hospitalId must be provided if type is HOSPITAL_NOTE' })
    hospitalId?: string;

        
    @ApiPropertyOptional({ example: 'https://example.com/folder/fileName.pdf'})
    @IsOptional()
    @IsString()
    fileUrl?: string;
}