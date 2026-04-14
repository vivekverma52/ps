import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { HTTP_MESSAGE_KEY } from '../decorators/message.decorator';

export interface ApiEnvelope<T = unknown> {
  success: true;
  message?: string;
  data: T;
}

/**
 * Global response interceptor — wraps every successful controller return value
 * into the standard API envelope:
 *
 *   { success: true, message?: string, data: <return_value> }
 *
 * The optional `message` is sourced from the @HttpMessage() decorator on the
 * handler. Error responses are NOT touched here — AllExceptionsFilter handles
 * those and already writes { success: false, ... }.
 *
 * NOTE: Controllers that use @Res() without passthrough:true bypass this
 * interceptor's output automatically (NestJS ignores the mapped value when
 * the response has already been flushed). This makes the refactor incremental
 * — legacy controllers remain unaffected until migrated.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiEnvelope<T>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiEnvelope<T>> {
    const message = this.reflector.getAllAndOverride<string | undefined>(HTTP_MESSAGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return next.handle().pipe(
      map((data): ApiEnvelope<T> => ({
        success: true,
        ...(message !== undefined ? { message } : {}),
        data: data ?? null,
      })),
    );
  }
}
