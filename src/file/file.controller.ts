import { BadRequestException, Body, Controller, Get, Param, Post, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { FileService } from './file.service';
import { MAX_FILE_SIZE, ALLOWED_MIME_TYPES } from '../common/constants/file.constants';

@Controller('file')
export class FileController {
    constructor(private readonly fileService: FileService) {}

    @Post('upload')
    @UseInterceptors(FileInterceptor('file', {
        limits: { fileSize: MAX_FILE_SIZE },
        fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'), false);
        }
        },
    }))
    async uploadFile(
        @UploadedFile() file: Express.Multer.File,
        @Body('folder') folder: string
    ) {
        if(!file) {
            throw new BadRequestException("File ['file'] is required!")
        }
        if(!['profiles', 'claims'].includes(folder)) {
            throw new BadRequestException('Invalid folder. Only "profiles" or "claims" allowed.');
        }

        return this.fileService.uploadFile(file, `${folder}/`);
    }

    @Post('bulkUpload')
    @UseInterceptors(FilesInterceptor('files', 5, {
        limits: { fileSize: MAX_FILE_SIZE },
        fileFilter: (req, file, cb) => {
            if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new BadRequestException('Invalid file type'), false);
            }
        },
    }))
    async uploadMultiple(
        @UploadedFiles() files: Express.Multer.File[],
        @Body('folder') folder: string
    ) {
        if (!files?.length) throw new BadRequestException('At least one file is required');
        if(!['profiles', 'claims'].includes(folder)) {
            throw new BadRequestException('Invalid folder. Only "profiles" or "claims" allowed.');
        }
        return this.fileService.uploadMultipleFiles(files, folder);
    }

    @Get(':fileName')
    async getUrl(@Param('fileName') fileName: string) {
        return this.fileService.getPresignedUrl('claims/c6ad876e-867d-457c-9fda-afdc549adafb.jpg')
    }   
    

}
