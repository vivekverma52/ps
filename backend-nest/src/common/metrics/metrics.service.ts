import { Injectable } from '@nestjs/common';
import {
  Registry,
  Counter,
  Histogram,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry: Registry;

  /** Total HTTP requests by method, route, status code */
  readonly httpRequestsTotal: Counter<string>;

  /** Request duration in seconds */
  readonly httpDurationSeconds: Histogram<string>;

  /** Total errors by type (4xx, 5xx, db, unknown) */
  readonly errorsTotal: Counter<string>;

  constructor() {
    this.registry = new Registry();

    // Collect Node.js default metrics (heap, GC, event loop lag, etc.)
    collectDefaultMetrics({ register: this.registry });

    this.httpRequestsTotal = new Counter({
      name:    'http_requests_total',
      help:    'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpDurationSeconds = new Histogram({
      name:    'http_request_duration_seconds',
      help:    'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets:  [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });

    this.errorsTotal = new Counter({
      name:    'app_errors_total',
      help:    'Total application errors by category',
      labelNames: ['type'],
      registers: [this.registry],
    });
  }

  /** Normalise URL paths so route params don't create unbounded cardinality.
   *  e.g. /api/prescriptions/abc-123 → /api/prescriptions/:id
   */
  normaliseRoute(path: string): string {
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/[a-f0-9]{24}/gi, '/:id')   // MongoDB ObjectId
      .replace(/\/\d+/g, '/:id');
  }
}
