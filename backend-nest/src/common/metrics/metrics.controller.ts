import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { MetricsService } from './metrics.service';

/**
 * Exposes Prometheus-format metrics at GET /api/metrics.
 * In production, protect this endpoint at the load-balancer level
 * so only your metrics scraper (Prometheus / Grafana) can reach it.
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getMetrics(@Res() res: Response) {
    const contentType = this.metricsService.registry.contentType;
    const metrics     = await this.metricsService.registry.metrics();
    res.set('Content-Type', contentType);
    res.end(metrics);
  }
}
