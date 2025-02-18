import { Injectable } from '@nestjs/common';
import { StatusChange, StatusTimeBreakdown } from '../interfaces/status.interface';

@Injectable()
export class StatusTimeAnalyzer {
  async analyzeIssueStatuses(
    issue: any,
    changelog: any,
    activeStatuses: string[]
  ): Promise<StatusTimeBreakdown> {
    const statusChanges = this.extractStatusChanges(changelog);
    const timeInStatuses = this.calculateTimeInStatuses(statusChanges, activeStatuses);

    return {
      issueKey: issue.key,
      timeInStatuses,
      totalActiveTime: Object.values(timeInStatuses).reduce((acc, time) => acc + time, 0)
    };
  }

  private extractStatusChanges(changelog: any[]): StatusChange[] {
    return changelog
      .filter(log => log.items.some(item => item.field === 'status'))
      .map(log => ({
        timestamp: new Date(log.created),
        fromStatus: log.items.find(item => item.field === 'status').fromString,
        toStatus: log.items.find(item => item.field === 'status').toString
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private calculateTimeInStatuses(
    statusChanges: StatusChange[],
    activeStatuses: string[]
  ): Record<string, number> {
    const timeInStatuses: Record<string, number> = {};

    activeStatuses.forEach(status => {
      timeInStatuses[status] = this.calculateTimeInStatus(statusChanges, status);
    });

    return timeInStatuses;
  }

  private calculateTimeInStatus(statusChanges: StatusChange[], status: string): number {
    let totalTime = 0;
    let statusStartTime: Date | null = null;

    for (const change of statusChanges) {
      if (change.toStatus === status) {
        statusStartTime = change.timestamp;
      } else if (statusStartTime && change.fromStatus === status) {
        totalTime += change.timestamp.getTime() - statusStartTime.getTime();
        statusStartTime = null;
      }
    }

    if (statusStartTime) {
      totalTime += new Date().getTime() - statusStartTime.getTime();
    }

    return totalTime;
  }
}