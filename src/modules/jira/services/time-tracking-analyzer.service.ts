import { TimeTrackingData } from '../models/time-tracking-data.model';

@Injectable()
export class TimeTrackingAnalyzer {
    analyzeTimeTracking(timeTrackingData: TimeTrackingData[]) {
        const estimateAccuracy = new Map<
            string,
            { count: number; totalAccuracy: number }
        >();
        let totalEstimated = 0;
        let totalSpent = 0;

        for (const data of timeTrackingData) {
            totalEstimated += data.originalEstimate;
            totalSpent += data.timeSpent;

            if (data.originalEstimate > 0) {
                const accuracy = (data.timeSpent / data.originalEstimate) * 100;
                this.updateEstimateAccuracy(estimateAccuracy, data.issueType, accuracy);
            }
        }

        return {
            totalEstimated,
            totalSpent,
            accuracyByType: this.calculateAccuracyByType(estimateAccuracy),
        };
    }

    private updateEstimateAccuracy(
        accuracyMap: Map<string, { count: number; totalAccuracy: number }>,
        issueType: string,
        accuracy: number,
    ) {
        const current = accuracyMap.get(issueType) || {
            count: 0,
            totalAccuracy: 0,
        };
        accuracyMap.set(issueType, {
            count: current.count + 1,
            totalAccuracy: current.totalAccuracy + accuracy,
        });
    }

    private calculateAccuracyByType(
        accuracyMap: Map<string, { count: number; totalAccuracy: number }>,
    ) {
        return Object.fromEntries(
            Array.from(accuracyMap.entries()).map(([type, data]) => [
                type,
                data.totalAccuracy / data.count,
            ]),
        );
    }
}
