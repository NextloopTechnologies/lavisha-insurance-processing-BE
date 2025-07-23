import { BadRequestException, Body, Controller, Delete, Get, Param, Post, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { FileService } from './file.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { DeleteFilesDto } from './dto/delete-files.dto';
import { S3FileUploadResult } from 'src/common/interfaces/s3.interface';
import { DeleteObjectsCommandOutput } from '@aws-sdk/client-s3';

@Controller('file')
@UseGuards(JwtAuthGuard)
export class FileController {
    constructor(private readonly fileService: FileService) {}

    @Post('upload')
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(
        @UploadedFile() file: Express.Multer.File,
        @Body('folder') folder: string
    ): Promise<S3FileUploadResult> {
        if(!file) {
            throw new BadRequestException("File ['file'] is required!")
        }
        if(!['profiles', 'claims'].includes(folder)) {
            throw new BadRequestException('Invalid folder. Only "profiles" or "claims" allowed.');
        }

        return this.fileService.uploadFile(file, `${folder}/`);
    }

    @Post('bulkUpload')
    @UseInterceptors(FilesInterceptor('files', 7))
    async uploadMultiple(
        @UploadedFiles() files: Express.Multer.File[],
        @Body('folder') folder: string
    ): Promise<S3FileUploadResult[]> {
        if (!files?.length || files?.length>6) throw new BadRequestException('Upload atleast 1 or max 5 files!');
        if(!['profiles', 'claims'].includes(folder)) {
            throw new BadRequestException('Invalid folder. Only "profiles" or "claims" allowed.');
        }
        return this.fileService.uploadMultipleFiles(files, `${folder}/`);
    }

    @Get(':fileName')
    async getUrl(@Param('fileName') fileName: string) {
        return this.fileService.getPresignedUrl('claims/c6ad876e-867d-457c-9fda-afdc549adafb.jpg')
    }   

    @Delete('bulkDelete')
    async bulkDelete(
        @Body() deleteFilesDto: DeleteFilesDto
    ): Promise<DeleteObjectsCommandOutput>{
        return this.fileService.deleteMultipleFiles(deleteFilesDto.fileNames)
    }
}
