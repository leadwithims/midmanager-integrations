import { BaseMetric } from './base-metric.interface';

export interface MetricCollection<T extends BaseMetric> {
  metrics: T[];
  push(metric: T): void;
  getAll(): T[];
}
