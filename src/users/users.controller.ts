import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-users.dto';
import { UpdateUserDto } from './dto/update-users.dto';
import { Prisma } from '@prisma/client';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { FindAllUserDto } from './dto/find-all-users.dto';
import { MutateUserResponseDto } from './dto/mutate-users-response.dto';
import { DropdownUsersDto, DropdownUsersResponseDto } from './dto/dropdown-users.dto';
import { Permissions } from 'src/auth/permissions/permissions.decorator';
import { Permission } from 'src/auth/permissions/permissions.enum';

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth('access_token')
export class UsersController {
    constructor(private usersService: UsersService) {}

    @Post()
    @Permissions(Permission.USER_CREATE)
    @ApiOperation({ summary: 'Creates a new user' })
    @ApiResponse({ status: 201, type: MutateUserResponseDto })
    register(@Body() body: CreateUserDto):  Promise<MutateUserResponseDto>{
        return this.usersService.create(body)
    }

    @Get('dropdown')
    @Permissions(Permission.USER_DROPDOWN_LIST)
    @ApiOperation({ summary: 'Dropdown list of users (id & name)' })
    @ApiResponse({ status: 200, type: DropdownUsersResponseDto })
    findDropdown(@Query() query: DropdownUsersDto ): Promise<DropdownUsersResponseDto[]> {
        const { search, role } = query

        const where:Prisma.UserWhereInput = {} 
        if (search) where.name = { contains: search, mode: 'insensitive' };
        if (role) where.role = role;

        return this.usersService.findDropdown(where);
    }

    @Get()
    @Permissions(Permission.USER_LIST)
    @ApiOperation({ summary: 'Get paginated list of users' })
    findAll(@Query() query: FindAllUserDto): Promise<PaginatedResult<MutateUserResponseDto>> {
        const { skip, take, sortBy, sortOrder, name, email, role } = query;

        const where: Prisma.UserWhereInput = {};
        if (name) where.name = { contains: name, mode: 'insensitive' };
        if (email) where.email = { contains: email, mode: 'insensitive' };
        if (role) where.role = role;

        const orderBy = sortBy ? { [sortBy]: sortOrder } : undefined;

        return this.usersService.findAll({ skip, take, where, orderBy });
    }

    @Get(':id')
    @Permissions(Permission.USER_READ)
    @ApiOperation({ summary: 'Get a User by ID' })
    @ApiResponse({ status: 200, type: MutateUserResponseDto })
    findOne(@Param('id') id: string): Promise<MutateUserResponseDto> {
        return this.usersService.findOne({ id });
    }
   
    @Patch(':id')
    @Permissions(Permission.USER_UPDATE)
    @ApiOperation({ summary: 'Update a User by ID, Refer CreateUserDto; all fields are optional here.' })
    @ApiResponse({ status: 200, type: MutateUserResponseDto })
    update(
        @Param('id') id: string, 
        @Body() updateuserDto: UpdateUserDto
    ): Promise<MutateUserResponseDto> {
        return this.usersService.update({
            where: { id },
            data: updateuserDto
        });
    }

    // @Patch('forgotPassword')
    // @ApiOperation({ summary: 'Update a User by ID, Refer CreateUserDto; all fields are optional here.' })
    // forgotPassword(
    //     @Request() req,
    //     @Body() body: { password, confirmPassword}
    // ) {
    //     const email = req.user.email
    //     return this.usersService.forgotPassword({ 
    //         where: email,
    //         data: body
    //     })
    // }


    @Delete(':id')
    @Permissions(Permission.USER_DELETE)
    @ApiOperation({ summary: 'Delete a User by ID' })
    remove(@Param('id') id: string): Promise<MutateUserResponseDto> {
       return this.usersService.remove({ id });
    }
}
