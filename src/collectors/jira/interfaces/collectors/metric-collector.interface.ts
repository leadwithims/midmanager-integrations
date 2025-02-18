export interface IMetricCollector {
  collectMetrics(): Promise<any[]>;
  validateMetrics(metrics: any[]): Promise<any[]>;
  saveMetrics(metrics: any[]): Promise<void>;
}
