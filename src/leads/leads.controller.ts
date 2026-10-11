import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Lead, Prisma } from '@prisma/client';
import { Public } from 'src/auth/decorators/public.decorator';
import { Permissions } from 'src/auth/permissions/permissions.decorator';
import { Permission } from 'src/auth/permissions/permissions.enum';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { CreateLeadDto } from './dto/create-lead.dto';
import { FindAllLeadsDto } from './dto/find-all-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LEADS_KEY_HEADER, LeadsKeyGuard } from './leads-key.guard';
import { LeadsService } from './leads.service';

@Controller('leads')
@ApiTags('Leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  // Called server-to-server by the marketing website, so no JWT — the shared key guards it.
  @Post()
  @Public()
  @UseGuards(LeadsKeyGuard)
  @HttpCode(201)
  @ApiHeader({
    name: LEADS_KEY_HEADER,
    required: true,
    description: 'Shared website key (LEADS_API_KEY)',
  })
  @ApiOperation({ summary: 'Create a lead from the website contact form' })
  @ApiResponse({ status: 201, description: 'Lead stored; admins notified' })
  create(@Body() dto: CreateLeadDto): Promise<{ id: string }> {
    return this.leadsService.create(dto);
  }

  @Get()
  @ApiBearerAuth('access_token')
  @Permissions(Permission.LEAD_LIST)
  @ApiOperation({ summary: 'Get paginated list of website leads' })
  findAll(@Query() query: FindAllLeadsDto): Promise<PaginatedResult<Lead>> {
    const { skip, take, sortBy, sortOrder, status, search } = query;
    const where: Prisma.LeadWhereInput = {};
    if (status) where.status = status;
    if (search) {
      where.OR = (['name', 'hospital', 'phone', 'email'] as const).map(
        (field) => ({
          [field]: { contains: search, mode: 'insensitive' },
        }),
      );
    }
    const orderBy = sortBy ? { [sortBy]: sortOrder } : undefined;

    return this.leadsService.findAll({ skip, take, where, orderBy });
  }

  @Patch(':id')
  @ApiBearerAuth('access_token')
  @Permissions(Permission.LEAD_UPDATE)
  @ApiOperation({ summary: 'Update a lead status' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadDto,
  ): Promise<Lead> {
    return this.leadsService.updateStatus(id, dto.status);
  }
}
