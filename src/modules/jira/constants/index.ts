export const JIRA_METRIC_TYPES = {
  ISSUE_COUNT: 'issue_count',
  TIME_IN_STATUS: 'time_in_status',
  SPRINT_PROGRESS: 'sprint_progress',
  TEAM_VELOCITY: 'team_velocity',
  TIME_TRACKING: 'time_tracking',
} as const;

export const JIRA_UNITS = {
  COUNT: 'count',
  HOURS: 'hours',
  DAYS: 'days',
  PERCENTAGE: 'percentage',
} as const;

export const DEFAULT_IGNORED_STATUSES = [
  'To Do',
  'Done',
  'Canceled',
  'Abandoned',
] as const;
