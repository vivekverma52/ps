import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppLogger } from './common/logger/app-logger.service';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AppDataSource } from './database/data-source';
import helmet from 'helmet';
// compression, cookie-parser and express-mongo-sanitize ship CommonJS without a default export;
// require() is the correct call here with this project's tsconfig (no esModuleInterop).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const compression = require('compression') as () => any;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cookieParser = require('cookie-parser') as () => any;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mongoSanitize = require('express-mongo-sanitize') as { sanitize: (v: any) => any };

async function runMigrations() {
  await AppDataSource.initialize();
  const ran = await AppDataSource.runMigrations();
  if (ran.length) {
    process.stdout.write(`[Migrations] Ran ${ran.length} migration(s): ${ran.map((m) => m.name).join(', ')}\n`);
  } else {
    process.stdout.write('[Migrations] All up to date.\n');
  }
  await AppDataSource.destroy();
}

async function bootstrap() {
  await runMigrations();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const logger        = app.get(AppLogger);
  const reflector     = app.get(Reflector);

  app.useLogger(logger);

  const port        = configService.get<number>('PORT', 5000);
  const frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
  const env         = configService.get<string>('NODE_ENV', 'development');

  // ── Disable ETag — prevents 304 on API responses ──────────────────────────
  app.set('etag', false);

  // ── Security headers ───────────────────────────────────────────────────────
  app.use(helmet());

  // ── Compress all responses ─────────────────────────────────────────────────
  app.use(compression());

  // ── CORS ───────────────────────────────────────────────────────────────────
  app.enableCors({ origin: frontendUrl, credentials: true });

  // ── Cookie parsing (required by @Cookies() decorator) ─────────────────────
  app.use(cookieParser());

  // ── NoSQL injection prevention ─────────────────────────────────────────────
  app.use((req: any, _res: any, next: any) => {
    if (req.body)   req.body   = mongoSanitize.sanitize(req.body);
    if (req.params) req.params = mongoSanitize.sanitize(req.params);
    if (req.query) {
      const clean = mongoSanitize.sanitize({ ...req.query });
      Object.keys(req.query).forEach((k) => delete req.query[k]);
      Object.assign(req.query, clean);
    }
    next();
  });

  // ── Global interceptors (outermost → innermost) ───────────────────────────
  // 1. LoggingInterceptor  — tracks request/response timing around everything
  // 2. ResponseInterceptor — wraps controller return values in { success, data }
  //
  // Controllers using @Res() without passthrough:true bypass interceptor output
  // automatically (NestJS discards the mapped value when the response is already
  // flushed), so legacy controllers are unaffected until individually migrated.
  app.useGlobalInterceptors(
    new LoggingInterceptor(logger),
    new ResponseInterceptor(reflector),
  );

  // ── Global exception filter ────────────────────────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  // ── Global validation pipe ─────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,             // strip fields not in the DTO
      forbidNonWhitelisted: true,  // reject requests with unknown fields
      transform: true,
    }),
  );

  // ── Required env var guard — fail fast rather than silently misbehave ──────
  const REQUIRED_ENV = [
    'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME',
    'MONGODB_URI',
    'JWT_SECRET', 'JWT_REFRESH_SECRET',
    'SUPERADMIN_JWT_SECRET',
    'AWS_S3_BUCKET', 'AWS_REGION',
    'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS',
  ];
  const missing = REQUIRED_ENV.filter((k) => !configService.get<string>(k));
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // ── Health check ───────────────────────────────────────────────────────────
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/api/health', (_req: any, res: any) => {
    res.json({ status: 'ok', time: new Date(), env });
  });

  await app.listen(port);

  logger.log(`Server started`, { port, env, frontendUrl });
}

// ── Process-level safety net ──────────────────────────────────────────────────

process.on('unhandledRejection', (reason: any) => {
  process.stderr.write(JSON.stringify({
    timestamp: new Date().toISOString(),
    level:     'error',
    context:   'Process',
    message:   'Unhandled promise rejection',
    errorMsg:  reason?.message ?? String(reason),
    errorCode: reason?.code    ?? undefined,
    stack:     reason?.stack   ?? undefined,
  }) + '\n');
});

process.on('uncaughtException', (err: Error) => {
  process.stderr.write(JSON.stringify({
    timestamp: new Date().toISOString(),
    level:     'error',
    context:   'Process',
    message:   'Uncaught exception — shutting down',
    errorMsg:  err?.message,
    stack:     err?.stack,
  }) + '\n');
  process.exit(1);
});

bootstrap().catch((err) => {
  process.stderr.write(JSON.stringify({
    timestamp: new Date().toISOString(),
    level:     'error',
    context:   'Bootstrap',
    message:   'Failed to start application',
    errorMsg:  err?.message,
    stack:     err?.stack,
  }) + '\n');
  process.exit(1);
});
