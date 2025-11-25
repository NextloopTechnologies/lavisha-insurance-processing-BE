import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthResponse } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService
    ) {}

    async validateUser(email: string, pass: string) {
        const user =  await this.prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            select: {
                id: true,
                name: true,
                password: true,
                email: true,
                role: true,
                hospitalId: true
            }
        });
        if (!user) throw new UnauthorizedException('Invalid credentials');

        const passwordValid = await bcrypt.compare(pass, user.password);
        if (!passwordValid) throw new UnauthorizedException('Invalid credentials');
        const { password, ...rest } = user
        return { ...rest };
    }

    async generateAndStoreToken(user: { id: string, name: string, email: string, role: Role }) {
        const payload = { sub: user.id, email: user.email, role: user.role }
        const token = await this.jwtService.signAsync(payload)
        if(!token) throw new UnauthorizedException('Failed to generate token!');
    
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                tokens: {
                    push: token,
                },
            },
        });

        return {
            user,
            access_token: token
        }
    }

    async login(email: string, password: string): Promise<AuthResponse> {
        const user = await this.validateUser(email, password);
        return await this.generateAndStoreToken(user);
    }

    async register(data: Prisma.UserCreateInput): Promise<AuthResponse> {
        const existingUser = await this.prisma.user.findUnique({
            where: { email: data.email.toLowerCase() },
        });
        if (existingUser) throw new BadRequestException('Email already in use');
        
        const hashedPassword = await bcrypt.hash(data.password, 10);
        const user = await this.prisma.user.create({
            data: {
                ...data,
                email: data.email.toLowerCase(),
                password: hashedPassword,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
            }
        });
        return await this.generateAndStoreToken(user);        
    }
}
