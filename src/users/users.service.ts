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
        const { hospitalId, rateListFileNames, ...rest } = data
        if (data.role === Role.HOSPITAL_MANAGER) {
            const exists = await this.prisma.user.findFirst({
                where: {
                    hospitalId: data.hospitalId,
                    role: Role.HOSPITAL_MANAGER,
                },
            });

            if (exists) {
                throw new BadRequestException('Manager already exists for this hospital');
            }
        }
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
                ...(hospitalId && { hospital: { connect: { id: hospitalId } } }),
                ...((data.role === Role.HOSPITAL && rateListFileNames?.length) && { rateListFileNames })
            },
            select: {
                id: true,
                name: true,
                email: true,
                address: true,
                hospitalName: true,
                rateListFileNames: true,
                hospital: { select: { id: true, name: true } },
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
        const [total, rawData] = await this.prisma.$transaction([
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
                    rateListFileNames: true,
                    hospital: { select: { id: true, name: true } },
                    role: true,
                }
            })
        ]);

        const data = await Promise.all(
            rawData.map(async (user) => {
                if (user.role === Role.HOSPITAL && user.rateListFileNames?.length) {
                    const rateListUrls = await Promise.all(
                        user.rateListFileNames.map((fileName) =>
                            this.fileService.getPresignedUrl(fileName)
                        )
                    );
                    return { ...user, rateListUrls };
                }
                return { ...user, rateListUrls: [] };
            })
        );

        return { total, data }
    }

    async findOne(
        userWhereUniqueInput: Prisma.UserWhereUniqueInput,
    ): Promise<MutateUserResponseDto> {
        const result = await this.prisma.user.findUniqueOrThrow({
            where: userWhereUniqueInput,
            select: {
                id: true,
                name: true,
                email: true,
                address: true,
                hospitalName: true,
                profileFileName: true,
                profileUrl: true,
                rateListFileNames: true,
                hospital: { select: { id: true, name: true } },
                role: true,
            }
        });

        let rateListUrls: string[] = [];
        if (result.role === Role.HOSPITAL && result.rateListFileNames?.length) {
            rateListUrls = await Promise.all(
                result.rateListFileNames.map((fileName) =>
                    this.fileService.getPresignedUrl(fileName)
                )
            );
        }

        return {
            ...result,
            rateListUrls,
        }
    }

    async update(params: {
        where: Prisma.UserWhereUniqueInput,
        data: UpdateUserDto
    }): Promise<MutateUserResponseDto> {
        const { where, data } = params;
        const { email, password, hospitalId, rateListFileNames, ...rest } = data;

        const isSuperAdminUser = await this.prisma.user.findFirst({
            where: {
                id: where.id,
                role: Role.SUPER_ADMIN
            }
        });
        if (isSuperAdminUser) throw new BadRequestException("SUPERADMIN role can't be modified!");

        return this.prisma.user.update({
            data: {
                ...rest,
                ...(hospitalId && { hospital: { connect: { id: hospitalId } } }),
                ...(rateListFileNames !== undefined && { rateListFileNames })
            },
            where,
            select: {
                id: true,
                name: true,
                email: true,
                address: true,
                hospitalName: true,
                rateListFileNames: true,
                hospital: { select: { id: true, name: true } },
                role: true,
            }
        });
    }

    async forgotPassword(
        where: Prisma.UserWhereUniqueInput,
        data: { password: string; confirmPassword: string }
    ) {
        const userExists = await this.prisma.user.findUnique({
            where,
            select: { id: true }
        });
        if (!userExists) throw new BadRequestException("Invalid User!!");

        const { password, confirmPassword } = data;
        if (password !== confirmPassword) throw new BadRequestException("Password Mismatched!");
        const hashedPassword = await bcrypt.hash(password, 10);
        return this.prisma.user.update({
            where,
            data: { password: hashedPassword }
        });
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
                rateListFileNames: true,
                role: true,
            }
        });

        const { profileFileName, rateListFileNames } = result;
        try {
            if (profileFileName) await this.fileService.deleteFile(profileFileName);
            if (rateListFileNames?.length) await this.fileService.deleteMultipleFiles(rateListFileNames);
        } catch (error) {
            console.error("USER_DELETE_SERVICE_S3: ", error);
        }

        return result;
    }
}