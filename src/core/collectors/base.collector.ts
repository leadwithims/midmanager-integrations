import { Logger } from '@nestjs/common';
import { BaseMetric } from '../interfaces/metrics/base-metric.interface';

export abstract class BaseCollector<T extends BaseMetric> {
  protected readonly logger: Logger;
  protected metrics: T[] = [];

  constructor() {
    this.logger = new Logger(this.constructor.name);
  }

  protected addMetric(metric: T) {
    this.metrics.push(metric);
  }

  protected getStartOfMonth(): Date {
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  abstract collectMetrics(): Promise<T[]>;
}