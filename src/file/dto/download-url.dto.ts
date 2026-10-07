import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class DownloadUrlQueryDto {
  @ApiProperty({ example: 'claims/report_674b86d2-4255-458a-aa7b-8e5d40ce9627.pdf', description: 'Stored file key of a claim document' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  key: string;
}

export class DownloadUrlResponseDto {
  @ApiProperty({ description: 'Presigned URL that makes the browser save the file (Content-Disposition: attachment)' })
  url: string;

  @ApiProperty({ example: 'report.pdf', description: 'Name the file is saved under' })
  fileName: string;
}
