import { Controller, Post, Body, Patch, Param, Request } from '@nestjs/common';
import { QueriesService } from './queries.service';
import { CreateQueryDto } from './dto/create-query.dto';
import { UpdateQueryDto } from './dto/update-query.dto';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MutateQueryResponseDto } from './dto/mutate-query-response.dto';

@Controller('queries')
export class QueriesController {
  constructor(private readonly queriesService: QueriesService) {}

  @Post()
  @ApiOperation({ summary: 'Create en Query' })
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
  @ApiOperation({ summary: 'Update enhacement by uuid, consider Create schema with all fields as optional.' })
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
