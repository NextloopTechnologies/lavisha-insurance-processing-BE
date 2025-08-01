import { Controller, Post, Body, Patch, Param, Request, UseGuards } from '@nestjs/common';
import { QueriesService } from './queries.service';
import { CreateQueryDto } from './dto/create-query.dto';
import { UpdateQueryDto } from './dto/update-query.dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MutateQueryResponseDto } from './dto/mutate-query-response.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@ApiTags("Queries")
@Controller('queries')
@ApiBearerAuth('access_token')
@UseGuards(JwtAuthGuard)
export class QueriesController {
  constructor(private readonly queriesService: QueriesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a Query' })
  @ApiBody({ type: CreateQueryDto })
  @ApiResponse({ status: 201, type: MutateQueryResponseDto })
  create(
    @Request() req,
    @Body() createQueryDto: CreateQueryDto
  ): Promise<MutateQueryResponseDto> {
    const uploadedBy = req.user.userId;
    return this.queriesService.create(createQueryDto, uploadedBy);
  }
  
  @Patch(':id')
  @ApiOperation({ summary: 'Update query by uuid, consider Create schema with all fields as optional.' })
  @ApiResponse({ status: 201, type: MutateQueryResponseDto })
  update(
    @Request() req,
    @Param('id') id: string, 
    @Body() updateQueryDto: UpdateQueryDto
  ): Promise<MutateQueryResponseDto> {
    const uploadedBy = req.user.userId;
    return this.queriesService.update({
      where: { id }, 
      data: updateQueryDto,
      uploadedBy
    });
  }
}
