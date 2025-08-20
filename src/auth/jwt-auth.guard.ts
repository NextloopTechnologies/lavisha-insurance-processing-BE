import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    // canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    //     return super.canActivate(context)
    // }
    constructor(private reflector: Reflector) {
        super();
    }

    canActivate(context: ExecutionContext) {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) {
            return true; // skip JWT validation
        }

        return super.canActivate(context);
    }

    handleRequest(err: any, user: any, info: any) {
        if (err) {
            console.error('❌ Passport Error:', err);
        }

        if (!user) {
            console.warn('⚠️ Invalid JWT:', info?.message || info);
            throw new UnauthorizedException(info?.message || 'Unauthorized');
        }

        return user;
    }
}
