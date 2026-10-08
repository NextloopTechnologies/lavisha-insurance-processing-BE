import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ALLOWED_MIME_TYPES, COMPRESSED_IMAGE_EXT, COMPRESSED_IMAGE_MIME, MAX_FILE_SIZE } from 'src/common/constants/file.constants';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { DeleteObjectCommand, DeleteObjectCommandOutput, DeleteObjectsCommand, DeleteObjectsCommandOutput, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getHospitalScope, RequestUser } from 'src/common/utils/access.utils';

const OWNER_SCOPE_METADATA_KEY = 'owner-scope';
const ADMIN_OWNER_SCOPE = 'admin';
// short-lived: the link is fetched right when the user clicks Download
const DOWNLOAD_URL_EXPIRES_SECONDS = 300;
import { s3 } from 'src/common/utils/s3.util';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3FileUploadResult } from 'src/common/interfaces/s3.interface';
import { compressImage, compressPdf } from 'src/common/utils/compress.utils';
import { attachmentDisposition, downloadNameFromKey } from 'src/common/utils/file-name.utils';
import { PrismaService } from 'src/prisma/prisma.service';
@Injectable()
export class FileService {

    constructor(private readonly prisma: PrismaService) { }

    async uploadFile(
        file: Express.Multer.File,
        folder: string,
        uploader: RequestUser
    ): Promise<S3FileUploadResult> {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            throw new BadRequestException(`Invalid file type. Only the following types are allowed: ${ALLOWED_MIME_TYPES}`);
        }

        if (file.size > MAX_FILE_SIZE) {
            throw new BadRequestException(`File too large, Max: ${(MAX_FILE_SIZE/1024)/1024} MB` );
        }

        const fileExt = extname(file.originalname);
        const safeName = file.originalname
        .replace(fileExt, '')           // remove extension
        .replace(/[^a-zA-Z0-9_-]/g, '_') // sanitize special chars/spaces
        .substring(0, 50);               // limit length

        // images are re-encoded to WebP, so the stored name and Content-Type say WebP
        const isImage = file.mimetype.startsWith('image/');
        const storedExt = isImage ? COMPRESSED_IMAGE_EXT : fileExt;
        const contentType = isImage ? COMPRESSED_IMAGE_MIME : file.mimetype;

        //  key = folder/originalName_UUID.ext
       const fileName = `${folder}${safeName}_${randomUUID()}${storedExt}`;
        // const fileName = `${folder}${randomUUID()}${fileExt}`;
        let buffer = file.buffer;

        if (file.mimetype === 'application/pdf') {
            buffer = await compressPdf(buffer);
        } else if (isImage) {
            buffer = await compressImage(buffer, file.mimetype);
        }

        await s3.send(new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: fileName,
            Body: buffer,
            ContentType: contentType,
            // records which hospital uploaded the object; checked on delete
            Metadata: { [OWNER_SCOPE_METADATA_KEY]: getHospitalScope(uploader) ?? ADMIN_OWNER_SCOPE }
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
        folder: string,
        uploader: RequestUser
    ): Promise<S3FileUploadResult[]>  {
        return Promise.all(files.map(file => this.uploadFile(file, folder, uploader)));
    }

    /**
     * Admins may delete any file. Hospital-level users may delete a file only if
     * their hospital uploaded it, or it is attached to one of their own records.
     */
    async assertCanDeleteFiles(keys: string[], user: RequestUser): Promise<void> {
        const scope = getHospitalScope(user);
        if (!scope) return;

        for (const key of keys) {
            if (await this.getOwnerScope(key) === scope) continue;
            if (await this.isFileReferencedByScope(key, scope, user.userId)) continue;
            throw new ForbiddenException(`Not allowed to delete file: ${key}`);
        }
    }

    private async getOwnerScope(key: string): Promise<string | undefined> {
        try {
            const head = await s3.send(new HeadObjectCommand({
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: key,
            }));
            return head.Metadata?.[OWNER_SCOPE_METADATA_KEY];
        } catch {
            // missing object or file uploaded before ownership tagging
            return undefined;
        }
    }

    private async isFileReferencedByScope(key: string, scope: string, userId: string): Promise<boolean> {
        const [document, patient, user] = await Promise.all([
            this.prisma.document.findFirst({
                where: { fileName: key, insuranceRequest: { patient: { hospitalUserId: scope } } },
                select: { id: true }
            }),
            this.prisma.patient.findFirst({
                where: { fileName: key, hospitalUserId: scope },
                select: { id: true }
            }),
            this.prisma.user.findFirst({
                where: {
                    id: { in: [scope, userId] },
                    OR: [{ profileFileName: key }, { rateListFileNames: { has: key } }]
                },
                select: { id: true }
            }),
        ]);
        return Boolean(document || patient || user);
    }

    async getPresignedUrl(
        key: string,
        expiresInSeconds = 10800,
        options: { asAttachment?: boolean } = {}
    ): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key,
            // S3 then serves the object with this header, so the browser saves it under its original name
            ...(options.asAttachment && { ResponseContentDisposition: attachmentDisposition(downloadNameFromKey(key)) }),
        });

        return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
    }

    /**
     * Download link for a claim document. Only keys that are documents on a claim
     * the caller can see are signed, i.e. the same files they already get view
     * links for; anything else is a 404 so file existence is not revealed.
     */
    async getDocumentDownloadUrl(key: string, user: RequestUser): Promise<{ url: string; fileName: string }> {
        const scope = getHospitalScope(user);
        const document = await this.prisma.document.findFirst({
            where: {
                fileName: key,
                insuranceRequest: scope ? { patient: { hospitalUserId: scope } } : { isNot: null },
            },
            select: { id: true },
        });
        if (!document) throw new NotFoundException('Document not found');

        return {
            url: await this.getPresignedUrl(key, DOWNLOAD_URL_EXPIRES_SECONDS, { asAttachment: true }),
            fileName: downloadNameFromKey(key),
        };
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
        const s3Result = await s3.send(new DeleteObjectsCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Delete: { Objects: objects },
        }));

        // Delete matching rows from the Document table
        await this.prisma.document.deleteMany({
            where: { fileName: { in: keys } },
        });

        return s3Result;
    }
}

