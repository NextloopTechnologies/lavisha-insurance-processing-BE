import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_TOKEN'),
      passReqToCallback: true
    });
  }

  async validate(req: Request, payload: any) {
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !token || !user.tokens.includes(token)) {
      throw new UnauthorizedException('Token is not recognized or has expired');
    }   

    const result: any = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    if (user.role === Role.HOSPITAL_MANAGER) {
      result.hospitalId = user.hospitalId;
    }
    
    return result;
  }
}
