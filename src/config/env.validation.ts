import { IsBooleanString, IsOptional, IsString } from 'class-validator';

export class EnvSchema {
    @IsString()
    DATABASE_URL: string

    @IsString()
    JWT_TOKEN: string;

    @IsBooleanString()
    ENABLE_FILE_UPLOAD: string;

    @IsOptional()
    @IsString()
    AWS_REGION?: string;

    @IsOptional()
    @IsString()
    AWS_ACCESS_KEY?: string;

    @IsOptional()
    @IsString()
    AWS_SECRET_KEY?: string;

    @IsOptional()
    @IsString()
    AWS_BUCKET_NAME?: string;
}