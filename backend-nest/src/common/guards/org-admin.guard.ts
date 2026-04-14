import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class OrgAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user?.isOrgAdmin && !user?.is_owner && user?.role !== 'ORG_ADMIN' && user?.role !== 'HOSPITAL_ADMIN') {
      throw new ForbiddenException({
        message: 'Org admin access required',
        errorCode: 'FORBIDDEN',
      });
    }

    return true;
  }
}
