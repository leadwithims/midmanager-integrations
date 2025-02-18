export interface BaseMetric {
  metricName: string;
  value: number;
  unit: string;
  timestamp: Date;
  category: string;
  metadata: Record<string, any>;
}

export interface MetricCollector<T extends BaseMetric> {
  collectMetrics(): Promise<T[]>;
}
