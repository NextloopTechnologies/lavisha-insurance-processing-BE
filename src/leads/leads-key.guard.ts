import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import type { Request } from 'express';

export const LEADS_KEY_HEADER = 'x-leads-key';

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * Lets only the marketing website's server create leads on the otherwise public
 * POST /leads route. Hashing first gives equal-length buffers for timingSafeEqual.
 */
@Injectable()
export class LeadsKeyGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('LEADS_API_KEY');
    if (!expected) {
      throw new ServiceUnavailableException('Lead intake is not configured');
    }

    const provided = context.switchToHttp().getRequest<Request>().headers[
      LEADS_KEY_HEADER
    ];
    if (
      typeof provided !== 'string' ||
      !timingSafeEqual(digest(provided), digest(expected))
    ) {
      throw new UnauthorizedException('Invalid leads key');
    }

    return true;
  }
}
