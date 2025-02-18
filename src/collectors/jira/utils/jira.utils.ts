export class JiraUtils {
    static calculateTimeInStatus(statusChanges: any[], status: string): number {
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

    static extractStatusChanges(changelog: any[]): any[] {
        return changelog
            .filter(log => log.items.some(item => item.field === 'status'))
            .map(log => ({
                timestamp: new Date(log.created),
                fromStatus: log.items.find(item => item.field === 'status').fromString,
                toStatus: log.items.find(item => item.field === 'status').toString
            }))
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }

    static convertSecondsToHours(seconds: number): number {
        return seconds / 3600;
    }

    static calculatePercentage(value: number, total: number): number {
        return total > 0 ? (value / total) * 100 : 0;
    }
}