import { BadRequestException, Injectable } from '@nestjs/common';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from 'src/common/constants/file.constants';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { s3 } from 'src/common/utils/s3.util';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class FileService {

    async uploadFile(file: Express.Multer.File, folder: string) {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            throw new BadRequestException('Invalid file type');
        }
        
        if (file.size > MAX_FILE_SIZE) {
            throw new BadRequestException('File too large');
        }
        
        const fileExt = extname(file.originalname);
        const fileName = `${folder}${randomUUID()}${fileExt}`;
        
        await s3.send(new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: fileName,
            Body: file.buffer,
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

    async uploadMultipleFiles(files: Express.Multer.File[], folder: string) {
        return Promise.all(files.map(file => this.uploadFile(file, folder)));
    }
    
    async getPresignedUrl(key: string, expiresInSeconds = 900) {
        const command = new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key,
        });

        return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
    }

    async deleteFile(key: string) {
        return s3.send(new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key,
        }));
    }

    async deleteMultipleFiles(keys: string[]) {
        const objects = keys.map(k => ({ Key: k }));
        return s3.send(new DeleteObjectsCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Delete: { Objects: objects },
        }));
    }
}

