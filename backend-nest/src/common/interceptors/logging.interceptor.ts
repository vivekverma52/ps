import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { AppLogger } from '../logger/app-logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLogger) {
    this.logger.setContext('HTTP');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req  = context.switchToHttp().getRequest();
    const res  = context.switchToHttp().getResponse();

    // Attach / forward request ID
    req.requestId = req.headers['x-request-id'] || uuidv4();
    res.setHeader('X-Request-Id', req.requestId);

    const { method, originalUrl } = req;
    const startMs = Date.now();

    this.logger.http('Incoming request', {
      requestId: req.requestId,
      method,
      path: originalUrl,
      userId: req.user?.userId ?? null,
      orgId:  req.user?.orgId  ?? null,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.http('Request completed', {
            requestId:  req.requestId,
            method,
            path:       originalUrl,
            statusCode: res.statusCode,
            durationMs: Date.now() - startMs,
            userId:     req.user?.userId ?? null,
            orgId:      req.user?.orgId  ?? null,
          });
        },
        error: (err) => {
          // Error path is handled by AllExceptionsFilter — log duration only
          this.logger.http('Request failed', {
            requestId:  req.requestId,
            method,
            path:       originalUrl,
            statusCode: err?.statusCode ?? 500,
            durationMs: Date.now() - startMs,
            userId:     req.user?.userId ?? null,
            orgId:      req.user?.orgId  ?? null,
          });
        },
      }),
    );
  }
}
