export interface MetricError {
  id: string;
  metricName: string;
  processError?: string | null;
  syncError?: string | null;
  processAttempts: number;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessedMetric {
  id: string;
  metricName: string;
  processedAt: Date;
  processedData: any; // Consider making this more specific based on your needs
}

export interface MetricsStatus {
  metrics: {
    pendingProcessing: number;
    processingFailed: number;
    readyForSync: number;
    syncFailed: number;
  };
  lastProcessed: ProcessedMetric[];
  recentErrors: MetricError[];
}
