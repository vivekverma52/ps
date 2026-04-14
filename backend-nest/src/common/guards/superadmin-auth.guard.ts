import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class SuperAdminAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({ message: 'No token provided', errorCode: 'UNAUTHORIZED' });
    }

    const token = authHeader.split(' ')[1];
    const saSecret = this.configService.get<string>('SUPERADMIN_JWT_SECRET');

    try {
      const decoded: any = jwt.verify(token, saSecret);
      if (decoded.type !== 'SUPERADMIN') {
        throw new ForbiddenException({ message: 'Superadmin access required', errorCode: 'FORBIDDEN' });
      }
      req.superAdmin = decoded;
      return true;
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      throw new UnauthorizedException({ message: 'Invalid or expired token', errorCode: 'UNAUTHORIZED' });
    }
  }
}
