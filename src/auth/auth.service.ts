import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcrypt';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private prisma: PrismaService,
        private jwtService: JwtService
    ) {}

    async validateUser(email: string, pass: string) {
        const user = await this.usersService.user({ email });
        if (!user) throw new UnauthorizedException('Invalid credentials');

        const passwordValid = await bcrypt.compare(pass, user.password);
        if (!passwordValid) throw new UnauthorizedException('Invalid credentials');

        const { password, ...result } = user;
        return result;
    }

    async login(email: string, password: string): Promise<{ user: Omit<User, 'password'>, access_token: string }> {
        const user = await this.validateUser(email, password);
        const payload = { sub: user.id, email: user.email }
        return {
            user,
            access_token: await this.jwtService.signAsync(payload)
        }
    }

    async register(data: Prisma.UserCreateInput) {
         const existingUser = await this.prisma.user.findUnique({
            where: { email: data.email.toLowerCase() },
        });

        if (existingUser) {
            throw new BadRequestException('Email already in use');
        }
        const hashedPassword = await bcrypt.hash(data.password, 10);
        const user = await this.prisma.user.create({
            data: {
                ...data,
                email: data.email.toLowerCase(),
                password: hashedPassword,
            },
        });

        const { password, ...rest } = user;
        return rest;
    }
}
