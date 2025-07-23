import { BadRequestException, Injectable } from '@nestjs/common';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from 'src/common/constants/file.constants';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { DeleteObjectCommand, DeleteObjectCommandOutput, DeleteObjectsCommand, DeleteObjectsCommandOutput, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { s3 } from 'src/common/utils/s3.util';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3FileUploadResult } from 'src/common/interfaces/s3.interface';
import { compressImage, compressPdf } from 'src/common/utils/compress.utils';

@Injectable()
export class FileService {

    async uploadFile(
        file: Express.Multer.File, 
        folder: string
    ): Promise<S3FileUploadResult> {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            throw new BadRequestException(`Invalid file type. Only the following types are allowed: ${ALLOWED_MIME_TYPES}`);
        }
        
        if (file.size > MAX_FILE_SIZE) {
            throw new BadRequestException(`File too large, Max: ${(MAX_FILE_SIZE/1024)/1024} MB` );
        }
        
        const fileExt = extname(file.originalname);
        const fileName = `${folder}${randomUUID()}${fileExt}`;
        let buffer = file.buffer;

        if (file.mimetype === 'application/pdf') {
            buffer = await compressPdf(buffer);
        } else if (file.mimetype.startsWith('image/')) {
            buffer = await compressImage(buffer, file.mimetype);
        }
        
        await s3.send(new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: fileName,
            Body: buffer,
            ContentType: file.mimetype
        }));

        const isProfile = folder.startsWith('profiles/');

        const url = isProfile
        ? `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`
        : undefined
        
        return {
            key: fileName,
            ...(url ? { url } : {}),
        };
    }

    async uploadMultipleFiles(
        files: Express.Multer.File[], 
        folder: string
    ): Promise<S3FileUploadResult[]>  {
        return Promise.all(files.map(file => this.uploadFile(file, folder)));
    }
    
    async getPresignedUrl(
        key: string, 
        expiresInSeconds = 10800
    ): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key,
        });

        return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
    }

    async deleteFile(
        key: string
    ): Promise<DeleteObjectCommandOutput> {
        return s3.send(new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key,
        }));
    }

    async deleteMultipleFiles(
        keys: string[]
    ): Promise<DeleteObjectsCommandOutput> {
        const objects = keys.map(k => ({ Key: k }));
        return s3.send(new DeleteObjectsCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Delete: { Objects: objects },
        }));
    }
}

