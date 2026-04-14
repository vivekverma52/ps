import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Typed param decorator for reading HTTP cookies.
 * Requires cookie-parser middleware to be registered in main.ts.
 *
 * @example
 * // Read a specific cookie
 * logout(@Cookies('refreshToken') token: string | undefined) { ... }
 *
 * // Read all cookies
 * handler(@Cookies() cookies: Record<string, string>) { ... }
 */
export const Cookies = createParamDecorator(
  (cookieName: string | undefined, ctx: ExecutionContext): string | Record<string, string> | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return cookieName ? request.cookies?.[cookieName] : request.cookies;
  },
);
