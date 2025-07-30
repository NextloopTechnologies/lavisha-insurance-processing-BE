import { PartialType } from '@nestjs/mapped-types';
import { CreateEnhancementDto } from './create-enhancements.dto';

export class UpdateEnhancementDto extends PartialType(CreateEnhancementDto) {}
