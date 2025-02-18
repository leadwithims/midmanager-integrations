export interface StatusChange {
  timestamp: Date;
  fromStatus: string;
  toStatus: string;
}

export interface StatusTimeBreakdown {
  issueKey: string;
  timeInStatuses: Record<string, number>;
  totalActiveTime: number;
}

export interface TimeTrackingData {
  originalEstimate: number;
  timeSpent: number;
  issueType: string;
}
