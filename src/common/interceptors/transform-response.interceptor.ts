import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from 'express';

export interface StandardResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  meta?: any;
  timestamp: string;
}

@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, StandardResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();

    return next.handle().pipe(
      map((resData) => {
        const statusCode = response.statusCode;

        // If response already structured with message and data
        if (
          resData &&
          typeof resData === 'object' &&
          'message' in resData &&
          'data' in resData
        ) {
          return {
            success: true,
            statusCode,
            message: resData.message || 'Operation successful',
            data: resData.data,
            ...(resData.meta && { meta: resData.meta }),
            timestamp: new Date().toISOString(),
          };
        }

        return {
          success: true,
          statusCode,
          message: 'Operation successful',
          data: resData,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
