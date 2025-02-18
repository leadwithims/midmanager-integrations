@Injectable()
export class StatusTimeAnalyzer {
  async analyzeIssueStatuses(
    issue: any,
    changelog: any,
    activeStatuses: string[],
  ): Promise<StatusTimeBreakdown> {
    const statusChanges = this.extractStatusChanges(changelog.values);
    const timeInStatuses = new Map<string, number>();

    for (const status of activeStatuses) {
      const timeInStatus = this.calculateTimeInStatus(statusChanges, status);
      if (timeInStatus > 0) {
        timeInStatuses.set(status, timeInStatus);
      }
    }

    return {
      issueKey: issue.key,
      timeInStatuses: Object.fromEntries(timeInStatuses),
      totalActiveTime: Array.from(timeInStatuses.values()).reduce(
        (a, b) => a + b,
        0,
      ),
    };
  }

  private extractStatusChanges(changelog: any[]): StatusChange[] {
    return changelog
      .filter((log) => log.items.some((item) => item.field === 'status'))
      .map((log) => ({
        timestamp: new Date(log.created),
        fromStatus: log.items.find((item) => item.field === 'status')
          .fromString,
        toStatus: log.items.find((item) => item.field === 'status').toString,
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private calculateTimeInStatus(
    statusChanges: StatusChange[],
    status: string,
  ): number {
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
