import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response, CookieOptions } from 'express';
import { SetMetadata } from '@nestjs/common';

// ── Metadata key & decorator ──────────────────────────────────────────────────

export const CLEAR_REFRESH_COOKIE_KEY = 'clear_refresh_cookie';

/**
 * Marks a handler so that RefreshTokenInterceptor clears the refresh cookie
 * instead of setting one.  Use on the logout endpoint.
 *
 * @example
 * @ClearRefreshCookie()
 * logout() { ... }
 */
export const ClearRefreshCookie = () => SetMetadata(CLEAR_REFRESH_COOKIE_KEY, true);

// ── Interceptor ───────────────────────────────────────────────────────────────

/**
 * Handles the refresh-token cookie lifecycle as a cross-cutting concern.
 *
 * On SET  (login / register / refresh):
 *   - Reads `refreshToken` from the service return value
 *   - Sets it as an httpOnly, Secure, SameSite=Strict cookie
 *   - Strips `refreshToken` from the response body so it is never
 *     exposed to JavaScript running in the browser
 *
 * On CLEAR (logout — annotated with @ClearRefreshCookie()):
 *   - Clears the cookie regardless of response body content
 *
 * Apply with @UseInterceptors(RefreshTokenInterceptor) on individual handlers
 * or at the controller level.  Because it needs ConfigService it must be
 * listed in the module's providers array.
 */
@Injectable()
export class RefreshTokenInterceptor implements NestInterceptor {
  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure:   this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
      path:     '/api/auth',
    };
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const shouldClear = this.reflector.get<boolean | undefined>(
      CLEAR_REFRESH_COOKIE_KEY,
      context.getHandler(),
    );

    const res = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data: unknown) => {
        if (shouldClear) {
          res.clearCookie('refreshToken', { ...this.cookieOptions(), maxAge: 0 });
          return data;
        }

        if (data !== null && typeof data === 'object' && 'refreshToken' in data) {
          const { refreshToken, ...rest } = data as Record<string, unknown>;
          res.cookie('refreshToken', refreshToken as string, this.cookieOptions());
          return rest;
        }

        return data;
      }),
    );
  }
}
