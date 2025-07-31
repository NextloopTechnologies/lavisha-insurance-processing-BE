import { Body, Controller, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { EnhancementsService } from './enhancements.service';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CreateEnhancementDto } from './dto/create-enhancements.dto';
import { MutateEnhancementsResponseDto } from './dto/mutate-enhancements-response.dto';
import { UpdateEnhancementDto } from './dto/update-enhancements.dto';

@Controller('enhancements')
@UseGuards(JwtAuthGuard)
@ApiTags("Enhancements")
@ApiBearerAuth('access_token')
export class EnhancementsController {
  constructor(private readonly enhancementsService: EnhancementsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an enhancement' })
  @ApiBody({ type: CreateEnhancementDto })
  @ApiResponse({ status: 201, type: MutateEnhancementsResponseDto })
  create(
    @Request() req,
    @Body() createEnhancementDto: CreateEnhancementDto
  ): Promise<MutateEnhancementsResponseDto> {
    const uploadedBy = req.user.userId;
    return this.enhancementsService.create(createEnhancementDto, uploadedBy);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an enhancement by uuid, consider Create schema with all fields as optional.' })
  @ApiResponse({ status: 201, type: MutateEnhancementsResponseDto })
  update(
    @Request() req,
    @Param('id') id: string, 
    @Body() updateEnhancementDto: UpdateEnhancementDto
  ): Promise<MutateEnhancementsResponseDto> {
    const uploadedBy = req.user.userId;
    return this.enhancementsService.update({
      where: { id }, 
      data: updateEnhancementDto,
      uploadedBy
    });
  }
}
