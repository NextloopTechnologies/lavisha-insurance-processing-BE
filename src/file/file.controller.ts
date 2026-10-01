import { BadRequestException, Body, Controller, Delete, Post, Request, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { FileService } from './file.service';
import { DeleteFilesDto } from './dto/delete-files.dto';
import { S3FileUploadResult, S3FileUploadResultDto } from 'src/common/interfaces/s3.interface';
import { DeleteObjectsCommandOutput } from '@aws-sdk/client-s3';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Permissions } from 'src/auth/permissions/permissions.decorator';
import { Permission } from 'src/auth/permissions/permissions.enum';
import { MAX_BULK_FILES, MULTER_FILE_SIZE_LIMIT } from 'src/common/constants/file.constants';
import { RequestUser } from 'src/common/utils/access.utils';

@ApiTags('File')
@Controller('file')
@ApiBearerAuth('access_token')
export class FileController {
    constructor(private readonly fileService: FileService) {}

    @Post('upload')
    @Permissions(Permission.FILE_SINGLE_UPLOAD)
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MULTER_FILE_SIZE_LIMIT, files: 1 } }))
    @ApiOperation({ summary: 'Upload a single file' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
        type: 'object',
        properties: {
            file: {
                type: 'string',
                format: 'binary',
            },
            folder: {
                type: 'string',
                    enum: ['profiles', 'claims', 'hospitals'],
                    example: 'profiles',
                },
            },
        },
    })
    @ApiResponse({ status: 201, type: S3FileUploadResultDto })
    async uploadFile(
        @Request() req: { user: RequestUser },
        @UploadedFile() file: Express.Multer.File,
        @Body('folder') folder: string
    ): Promise<S3FileUploadResult> {
        if(!file) {
            throw new BadRequestException("File ['file'] is required!")
        }
        if(!['profiles', 'claims','hospitals'].includes(folder)) {
            throw new BadRequestException('Invalid folder. Only "profiles", "claims" or "hospitals" allowed.');
        }

        return this.fileService.uploadFile(file, `${folder}/`, req.user);
    }

    @Post('bulkUpload')
    @Permissions(Permission.FILE_BULK_UPLOAD)
    @UseInterceptors(FilesInterceptor('files', MAX_BULK_FILES, { limits: { fileSize: MULTER_FILE_SIZE_LIMIT, files: MAX_BULK_FILES } }))
    @ApiOperation({ summary: 'Upload multiple files (max 6)' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                files: {
                    type: 'array',
                    items: {
                        type: 'string',
                        format: 'binary',
                    },
                },
                folder: {
                    type: 'string',
                    enum: ['profiles', 'claims','hospitals'],
                    example: 'claims',
                },
            },
        },
    })
    @ApiResponse({ status: 200, type: [S3FileUploadResultDto] })
    async uploadMultiple(
        @Request() req: { user: RequestUser },
        @UploadedFiles() files: Express.Multer.File[],
        @Body('folder') folder: string
    ): Promise<S3FileUploadResult[]> {
        if (!files?.length || files?.length > MAX_BULK_FILES) throw new BadRequestException(`Upload atleast 1 or max ${MAX_BULK_FILES} files!`);
        if(!['profiles', 'claims', 'hospitals'].includes(folder)) {
            throw new BadRequestException('Invalid folder. Only "profiles", "claims" or "hospitals" allowed.');
        }
        return this.fileService.uploadMultipleFiles(files, `${folder}/`, req.user);
    }

    @Delete('bulkDelete')
    @Permissions(Permission.FILE_SINGLE_UPLOAD)
    @ApiOperation({ summary: 'Delete multiple files by file name; non-admins can only delete their own hospital\'s files' })
    @ApiBody({ type: DeleteFilesDto })
    async bulkDelete(
        @Request() req: { user: RequestUser },
        @Body() deleteFilesDto: DeleteFilesDto
    ): Promise<DeleteObjectsCommandOutput>{
        await this.fileService.assertCanDeleteFiles(deleteFilesDto.fileNames, req.user)
        return this.fileService.deleteMultipleFiles(deleteFilesDto.fileNames)
    }
}
