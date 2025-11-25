import { PartialType } from '@nestjs/mapped-types';
import { CreateInsuranceRequestDto } from './create-insurance-request.dto';

export class UpdateInsuranceRequestDto extends PartialType(CreateInsuranceRequestDto) {}
