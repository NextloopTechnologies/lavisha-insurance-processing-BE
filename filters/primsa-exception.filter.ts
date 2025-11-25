// filters/prisma-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    switch (exception.code) {
      case 'P2025':
        response.status(404).json({
          statusCode: 404,
          message: 'Record not found',
          error: 'NotFoundError',
          path: request.url,
        });
        break;
      case 'P2002':
        response.status(409).json({
          statusCode: 409,
          message: `Duplicate value for unique field: ${exception.meta?.target}`,
          error: 'ConflictError',
          path: request.url,
        });
        break;
      default:
        response.status(500).json({
          statusCode: 500,
          message: 'Internal server error',
          error: exception.message,
          path: request.url,
        });
        break;
    }
  }
}
