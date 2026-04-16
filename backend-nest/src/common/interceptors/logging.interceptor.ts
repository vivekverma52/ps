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
import { MetricsService } from '../metrics/metrics.service';
import { requestContextStorage } from '../context/request-context';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: AppLogger,
    private readonly metrics: MetricsService,
  ) {
    this.logger.setContext('HTTP');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req  = context.switchToHttp().getRequest();
    const res  = context.switchToHttp().getResponse();

    // Attach / forward request ID
    req.requestId = req.headers['x-request-id'] || uuidv4();
    res.setHeader('X-Request-Id', req.requestId);

    const { method, originalUrl } = req;
    const startMs  = Date.now();
    const route    = this.metrics.normaliseRoute(originalUrl);
    const reqCtx   = {
      traceId: req.requestId as string,
      userId:  req.user?.userId as string | undefined,
      orgId:   req.user?.orgId  as string | undefined,
    };

    this.logger.http('Incoming request', {
      requestId: req.requestId,
      method,
      path: originalUrl,
      userId: req.user?.userId ?? null,
      orgId:  req.user?.orgId  ?? null,
    });

    // Wrap the entire handler in AsyncLocalStorage so every service/repo
    // log entry in this request automatically gets the traceId.
    return new Observable(subscriber => {
      requestContextStorage.run(reqCtx, () => {
        next.handle().pipe(
          tap({
            next: () => {
              const durationMs = Date.now() - startMs;
              const status     = String(res.statusCode);

              this.metrics.httpRequestsTotal.inc({ method, route, status_code: status });
              this.metrics.httpDurationSeconds.observe(
                { method, route, status_code: status },
                durationMs / 1000,
              );

              this.logger.http('Request completed', {
                requestId:  req.requestId,
                method,
                path:       originalUrl,
                statusCode: res.statusCode,
                durationMs,
                userId:     req.user?.userId ?? null,
                orgId:      req.user?.orgId  ?? null,
              });
            },
            error: (err) => {
              const durationMs = Date.now() - startMs;
              const statusCode = err?.statusCode ?? 500;
              const status     = String(statusCode);

              this.metrics.httpRequestsTotal.inc({ method, route, status_code: status });
              this.metrics.httpDurationSeconds.observe(
                { method, route, status_code: status },
                durationMs / 1000,
              );

              // Error path is handled by AllExceptionsFilter — log duration only
              this.logger.http('Request failed', {
                requestId:  req.requestId,
                method,
                path:       originalUrl,
                statusCode,
                durationMs,
                userId:     req.user?.userId ?? null,
                orgId:      req.user?.orgId  ?? null,
              });
            },
          }),
        ).subscribe(subscriber);
      });
    });
  }
}
