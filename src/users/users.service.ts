import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { MutateUserResponseDto } from './dto/mutate-users-response.dto';
import { FileService } from 'src/file/file.service';
import { DropdownUsersResponseDto } from './dto/dropdown-users.dto';
import { CreateUserDto } from './dto/create-users.dto';
import { UpdateUserDto } from './dto/update-users.dto';

@Injectable()
export class UsersService {
    constructor(
        private prisma: PrismaService,
        private fileService: FileService
    ){}

    async create(
        data: CreateUserDto
    ): Promise<MutateUserResponseDto> {
        const { hospitalId, rateListFileName, ...rest } = data
        const existingUser = await this.prisma.user.findUnique({
            where: { email: data.email.toLowerCase() },
        });
        if (existingUser) throw new BadRequestException('Email already in use');
        
        const hashedPassword = await bcrypt.hash(data.password, 10);
        return await this.prisma.user.create({
            data: {
                ...rest,
                email: data.email.toLowerCase(),
                password: hashedPassword,
                ...(hospitalId && { hospital: { connect: { id: hospitalId }}}),
                ...((data.role===Role.HOSPITAL && rateListFileName) && { rateListFileName })
            },
            select: {
                id: true,
                name: true,
                email: true,
                address: true,
                hospitalName: true,
                rateListFileName: true,
                rateListUrl: true,
                hospital: { select: { id: true, name: true }},
                role: true,
            }
        });
    }

    async findDropdown(
        where?: Prisma.UserWhereInput
    ): Promise<DropdownUsersResponseDto[]> {
        const data = await this.prisma.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                role: true
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
        const result = data
            .filter(value => value.role !== Role.SUPER_ADMIN)
      
        return result
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
                    hospital: { select: { id: true, name: true }},
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
                hospital: { select: { id: true, name: true }},
                role: true,
            }
        })
        let rateListUrl: string;
        if(result.role===Role.HOSPITAL && result.rateListFileName){
            rateListUrl = await this.fileService.getPresignedUrl(result.rateListFileName);
        }
        return {
            ...result,
            rateListUrl: rateListUrl ? rateListUrl : null
        }
    }

    async update(params: {
        where: Prisma.UserWhereUniqueInput,
        data: UpdateUserDto
    }): Promise<MutateUserResponseDto> {
        const { where, data } = params;
        const { email, password, hospitalId, ...rest } = data
         const isSuperAdminUser = await this.prisma.user.findFirst({
            where: { 
                id: where.id,
                role: Role.SUPER_ADMIN
            }
        })
        if(isSuperAdminUser) throw new BadRequestException("SUPERADMIN role can't be modified!")
        return this.prisma.user.update({ 
            data: { 
                ...rest,
                ...(hospitalId && { hospital: { connect: { id: hospitalId }}})
            }, 
            where,
            select: {
                id: true,
                name: true,
                email: true,
                address: true,
                hospitalName: true,
                rateListFileName: true,
                rateListUrl: true,
                hospital: { select: { id: true, name: true }},
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
        whereUniqueInput: Prisma.UserWhereUniqueInput
    ): Promise<MutateUserResponseDto>{
        const isUserExists = await this.prisma.user.findFirst({
            where: whereUniqueInput,
            select: { id: true, role: true }
        })
        if(isUserExists.role===Role.SUPER_ADMIN) throw new BadRequestException("SUPERADMIN role can't be modified!")

        const result =  await this.prisma.user.delete({
            where: whereUniqueInput,
            select: {
                id: true,
                name: true,
                email: true,
                profileFileName: true,
                rateListFileName: true,
                role: true,
            }
        })
        const { profileFileName, rateListFileName} = result
        try {
            if(profileFileName) await this.fileService.deleteFile(profileFileName)
            if(rateListFileName) await this.fileService.deleteFile(rateListFileName)
        } catch (error) {
            console.error("USER_DELETE_SERVICE_S3: ", error)
        }

        return result
    }
}
