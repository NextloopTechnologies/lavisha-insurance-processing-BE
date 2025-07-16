import { IsBooleanString, IsInt, IsOptional, IsString } from 'class-validator';

export class EnvSchema {
    @IsString()
    DB_USER: string;

    @IsString()
    DB_PASSWORD: string;

    @IsOptional()
    @IsString()
    DB_HOST?: string;
    
    @IsString()
    DB_NAME: string;

    @IsOptional()
    @IsString()
    DB_PORT?: string;

    @IsOptional()
    @IsBooleanString()
    SKIP_SEED?: string;

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