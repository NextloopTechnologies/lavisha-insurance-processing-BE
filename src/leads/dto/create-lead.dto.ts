import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
// Optional fields: treat "" as not provided.
const trimOptional = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class CreateLeadDto {
  @ApiProperty({ example: 'Dr. Asha Verma' })
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  name: string;

  @ApiProperty({ example: 'City Care Hospital' })
  @Transform(trim)
  @IsString()
  @Length(2, 150)
  hospital: string;

  @ApiProperty({ example: '+91 98765 43210' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[+\d][\d\s-]{7,}$/, {
    message: 'phone must be a valid phone number',
  })
  phone: string;

  @ApiPropertyOptional({ example: 'desk@citycare.in' })
  @Transform(trimOptional)
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({ example: 'Indore' })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({
    example: '25 – 100',
    description: 'Cashless admissions per month',
  })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  volume?: string;

  @ApiPropertyOptional({ example: 'Queries take days to close.' })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
