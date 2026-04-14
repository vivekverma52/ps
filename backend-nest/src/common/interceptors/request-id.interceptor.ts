import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    req.requestId = req.headers['x-request-id'] || uuidv4();
    const res = context.switchToHttp().getResponse();
    res.setHeader('X-Request-Id', req.requestId);
    return next.handle();
  }
}
