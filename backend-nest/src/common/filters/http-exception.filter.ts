import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppError } from '../errors/app.error';
import { isMySqlError, mapMySqlError } from '../errors/db-error.util';
import { AppLogger } from '../logger/app-logger.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {
    this.logger.setContext('ExceptionFilter');
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const requestId = (req as any).requestId ?? null;
    const base = {
      requestId,
      method:  req.method,
      path:    req.originalUrl,
      userId:  (req as any).user?.userId ?? null,
      orgId:   (req as any).user?.orgId  ?? null,
    };

    // ── Multer: file too large ─────────────────────────────────────────────
    if ((exception as any)?.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success:   false,
        message:   'File too large. Max 10 MB allowed.',
        errorCode: 'FILE_TOO_LARGE',
      });
    }

    // ── Multer: invalid file type ──────────────────────────────────────────
    if ((exception as any)?.message?.startsWith('Only images')) {
      return res.status(400).json({
        success:   false,
        message:   (exception as any).message,
        errorCode: 'INVALID_FILE_TYPE',
      });
    }

    // ── JWT errors ─────────────────────────────────────────────────────────
    if (
      (exception as any)?.name === 'JsonWebTokenError' ||
      (exception as any)?.name === 'TokenExpiredError'
    ) {
      return res.status(401).json({
        success:   false,
        message:   'Invalid or expired token',
        errorCode: 'UNAUTHORIZED',
      });
    }

    // ── Mongoose validation error ──────────────────────────────────────────
    if ((exception as any)?.name === 'ValidationError') {
      const messages = Object.values((exception as any).errors || {})
        .map((e: any) => e.message)
        .join('; ');
      return res.status(422).json({
        success:   false,
        message:   messages,
        errorCode: 'VALIDATION_ERROR',
      });
    }

    // ── Mongoose cast error (bad ObjectId) ────────────────────────────────
    if ((exception as any)?.name === 'CastError') {
      return res.status(400).json({
        success:   false,
        message:   'Invalid identifier format',
        errorCode: 'BAD_REQUEST',
      });
    }

    // ── MySQL / TCP database errors ────────────────────────────────────────
    if (isMySqlError(exception)) {
      const appErr = mapMySqlError(exception);
      const err    = exception as any;

      // Log DB errors at warn level (operational) or error level (unexpected)
      const isOperationalDbError = appErr.statusCode < 500;
      if (isOperationalDbError) {
        this.logger.warn(`DB error: ${err?.code}`, {
          ...base,
          errorCode:  appErr.errorCode,
          statusCode: appErr.statusCode,
          sqlMessage: err?.sqlMessage ?? undefined,
        });
      } else {
        this.logger.error(`Unexpected DB error: ${err?.code}`, {
          ...base,
          errorCode:  appErr.errorCode,
          sqlMessage: err?.sqlMessage ?? undefined,
          sql:        err?.sql        ?? undefined,
        }, err?.stack);
      }

      return res.status(appErr.statusCode).json({
        success:   false,
        message:   appErr.message,
        errorCode: appErr.errorCode,
      });
    }

    // ── AppError (operational — expected business errors) ──────────────────
    if (exception instanceof AppError && exception.isOperational) {
      this.logger.warn(exception.message, {
        ...base,
        errorCode:  exception.errorCode,
        statusCode: exception.statusCode,
      });

      const body: any = {
        success:   false,
        message:   exception.message,
        errorCode: exception.errorCode,
      };
      if (exception.current !== undefined) body.current = exception.current;
      if (exception.limit   !== undefined) body.limit   = exception.limit;
      if (exception.plan    !== undefined) body.plan     = exception.plan;
      return res.status(exception.statusCode).json(body);
    }

    // ── NestJS HttpException ───────────────────────────────────────────────
    if (exception instanceof HttpException) {
      const status  = exception.getStatus();
      const exRes   = exception.getResponse();

      this.logger.warn(exception.message, {
        ...base,
        statusCode: status,
      });

      if (typeof exRes === 'object') {
        return res.status(status).json({ success: false, ...(exRes as object) });
      }
      return res.status(status).json({
        success:   false,
        message:   exRes,
        errorCode: AppError._defaultCode(status),
      });
    }

    // ── Unknown / programming error → stderr ──────────────────────────────
    const err = exception as any;
    this.logger.error('Unhandled exception', {
      ...base,
      errorName: err?.name,
      errorMsg:  err?.message,
      errorCode: err?.code,
    }, err?.stack);

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success:   false,
      message:   'An unexpected error occurred. Please try again later.',
      errorCode: 'INTERNAL_ERROR',
    });
  }
}
