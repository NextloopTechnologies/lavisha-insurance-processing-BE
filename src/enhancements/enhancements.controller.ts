import { Body, Controller, Param, Patch, Post, Request } from '@nestjs/common';
import { EnhancementsService } from './enhancements.service';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateEnhancementDto } from './dto/create-enhancements.dto';
import { MutateEnhancementsResponseDto } from './dto/mutate-enhancements-response.dto';
import { UpdateEnhancementDto } from './dto/update-enhancements.dto';
import { Permissions } from 'src/auth/permissions/permissions.decorator';
import { Permission } from 'src/auth/permissions/permissions.enum';

@Controller('enhancements')
@ApiTags("Enhancements")
@ApiBearerAuth('access_token')
export class EnhancementsController {
  constructor(private readonly enhancementsService: EnhancementsService) {}

  @Post()
  @Permissions(Permission.ENHANCEMENT_CREATE)
  @ApiOperation({ summary: 'Create an enhancement' })
  @ApiBody({ type: CreateEnhancementDto })
  @ApiResponse({ status: 201, type: MutateEnhancementsResponseDto })
  create(
    @Request() req,
    @Body() createEnhancementDto: CreateEnhancementDto
  ): Promise<MutateEnhancementsResponseDto> {
    const {userId:uploadedBy, name:userName }= req.user;
    return this.enhancementsService.create(createEnhancementDto, uploadedBy, userName);
  }

  @Patch(':id')
  @Permissions(Permission.ENHANCEMENT_UPDATE)
  @ApiOperation({ summary: 'Update an enhancement by uuid, consider Create schema with all fields as optional.' })
  @ApiResponse({ status: 201, type: MutateEnhancementsResponseDto })
  update(
    @Request() req,
    @Param('id') id: string, 
    @Body() updateEnhancementDto: UpdateEnhancementDto
  ): Promise<MutateEnhancementsResponseDto> {
    const {userId:uploadedBy, name:userName }= req.user;
    return this.enhancementsService.update({
      where: { id }, 
      data: updateEnhancementDto,
      uploadedBy,
      userName
    });
  }
}
