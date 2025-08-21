import { BadRequestException, Body, Controller, Delete, Get, Param, Post, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { FileService } from './file.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { DeleteFilesDto } from './dto/delete-files.dto';
import { S3FileUploadResult, S3FileUploadResultDto } from 'src/common/interfaces/s3.interface';
import { DeleteObjectsCommandOutput } from '@aws-sdk/client-s3';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Permissions } from 'src/auth/permissions/permissions.decorator';
import { Permission } from 'src/auth/permissions/permissions.enum';

@ApiTags('File')
@Controller('file')
// @UseGuards(JwtAuthGuard)
@ApiBearerAuth('access_token')
export class FileController {
    constructor(private readonly fileService: FileService) {}

    @Post('upload')
    @Permissions(Permission.FILE_SINGLE_UPLOAD)
    @UseInterceptors(FileInterceptor('file'))
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
        @UploadedFile() file: Express.Multer.File,
        @Body('folder') folder: string
    ): Promise<S3FileUploadResult> {
        if(!file) {
            throw new BadRequestException("File ['file'] is required!")
        }
        if(!['profiles', 'claims','hospitals'].includes(folder)) {
            throw new BadRequestException('Invalid folder. Only "profiles", "claims" or "hospitals" allowed.');
        }

        return this.fileService.uploadFile(file, `${folder}/`);
    }

    @Post('bulkUpload')
     @Permissions(Permission.FILE_BULK_UPLOAD)
    @UseInterceptors(FilesInterceptor('files', 7))
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
        @UploadedFiles() files: Express.Multer.File[],
        @Body('folder') folder: string
    ): Promise<S3FileUploadResult[]> {
        if (!files?.length || files?.length>6) throw new BadRequestException('Upload atleast 1 or max 5 files!');
        if(!['profiles', 'claims', 'hospitals'].includes(folder)) {
            throw new BadRequestException('Invalid folder. Only "profiles", "claims" or "hospitals" allowed.');
        }
        return this.fileService.uploadMultipleFiles(files, `${folder}/`);
    }

    @Delete('bulkDelete')
    @ApiOperation({ summary: 'Delete multiple files by file name' })
    @ApiBody({ type: DeleteFilesDto })
    async bulkDelete(
        @Body() deleteFilesDto: DeleteFilesDto
    ): Promise<DeleteObjectsCommandOutput>{
        return this.fileService.deleteMultipleFiles(deleteFilesDto.fileNames)
    }
}
