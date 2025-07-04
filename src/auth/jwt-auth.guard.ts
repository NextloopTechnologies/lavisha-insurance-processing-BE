import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        return super.canActivate(context)
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
