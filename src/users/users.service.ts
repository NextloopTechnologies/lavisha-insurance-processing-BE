import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { MutateUserResponseDto } from './dto/mutate-users-response.dto';
import { FileService } from 'src/file/file.service';
import { DropdownUsersResponseDto } from './dto/dropdown-users.dto';

@Injectable()
export class UsersService {
    constructor(
        private prisma: PrismaService,
        private fileService: FileService
    ){}

    async create(
        data: Prisma.UserCreateInput
    ): Promise<MutateUserResponseDto> {
        const existingUser = await this.prisma.user.findUnique({
            where: { email: data.email.toLowerCase() },
        });
        if (existingUser) throw new BadRequestException('Email already in use');
        
        const hashedPassword = await bcrypt.hash(data.password, 10);
        return await this.prisma.user.create({
            data: {
                ...data,
                email: data.email.toLowerCase(),
                password: hashedPassword,
            },
            select: {
                id: true,
                name: true,
                email: true,
                address: true,
                hospitalName: true,
                rateListFileName: true,
                rateListUrl: true,
                role: true,
            }
        });
    }

    async findDropdown(
        where?: Prisma.UserWhereInput
    ): Promise<DropdownUsersResponseDto[]> {
        return this.prisma.user.findMany({
            where,
            select: {
                id: true,
                name: true
            },
            take: 20,
        });
    }

    async findAll(params: {
        skip?: number;
        take?: number;
        where?: Prisma.UserWhereInput;
        orderBy?: Prisma.UserOrderByWithRelationInput;
    }): Promise<PaginatedResult<MutateUserResponseDto>> {
        const { skip, take, where, orderBy } = params;
        const [total, data] = await this.prisma.$transaction([
            this.prisma.user.count({ where }),
            this.prisma.user.findMany({
                skip,
                take,
                where,
                orderBy,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    address: true,
                    hospitalName: true,
                    role: true,
                }
            })
        ])
        return { total, data }
    }

    async findOne(
        userWhereUniqueInput: Prisma.UserWhereUniqueInput,
    ): Promise<MutateUserResponseDto> {
        const result = await this.prisma.user.findUnique({
            where: userWhereUniqueInput,
            select: {
                id: true,
                name: true,
                email: true,
                address: true,
                hospitalName: true,
                profileFileName: true,
                profileUrl: true,
                rateListFileName: true,
                rateListUrl: true,
                role: true,
            }
        })
        const url = await this.fileService.getPresignedUrl(result.rateListFileName);
        return {
            ...result,
            rateListUrl: url
        }

    }

    async update(params: {
        where: Prisma.UserWhereUniqueInput,
        data: Prisma.UserUpdateInput
    }): Promise<MutateUserResponseDto> {
        const { where, data } = params;
        const { email, password, ...rest } = data
        return this.prisma.user.update({ 
            data: { ...rest }, 
            where,
            select: {
                id: true,
                name: true,
                email: true,
                address: true,
                hospitalName: true,
                rateListFileName: true,
                rateListUrl: true,
                role: true,
            }
        })
    }

    async forgotPassword(
        where: Prisma.UserWhereUniqueInput,
        data: { password: string; confirmPassword: string }
    ) {
        const userExists = await this.prisma.user.findUnique({
            where,
            select: { id: true }
        })
        if(!userExists) throw new BadRequestException("Invalid User!!")

        const { password, confirmPassword } = data
        if(password!==confirmPassword) throw new BadRequestException("Password Mismatched!")
        const hashedPassword = await bcrypt.hash(password, 10);
        return this.prisma.user.update({
            where,
            data: { password: hashedPassword }
        })
    }

    async remove(
        where: Prisma.UserWhereUniqueInput
    ): Promise<MutateUserResponseDto>{
        return this.prisma.user.delete({
            where,
            select: {
                id: true,
                name: true,
                email: true,
                address: true,
                hospitalName: true,
                rateListFileName: true,
                rateListUrl: true,
                role: true,
            }
        })
    }
}
