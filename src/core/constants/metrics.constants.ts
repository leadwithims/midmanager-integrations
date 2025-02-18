export enum MetricCategory {
    ISSUES = 'issues',
    SPRINTS = 'sprints',
    VELOCITY = 'velocity',
    WORKLOAD = 'workload',
    SLA = 'sla',
    TIME_TRACKING = 'time_tracking',
    TEAM_PERFORMANCE = 'team_performance',
    USER_PERFORMANCE = 'user_performance',
    CODE_QUALITY = "CODE_QUALITY",
    COLLABORATION = "COLLABORATION"
}

export const METRIC_UNITS = {
    COUNT: 'count',
    HOURS: 'hours',
    PERCENTAGE: 'percentage',
    DAYS: 'days',
    ISSUES: 'issues'
} as const;