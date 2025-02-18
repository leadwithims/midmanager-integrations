import {
  IsString,
  IsNumber,
  IsDate,
  IsObject,
  IsOptional,
  IsEnum,
} from 'class-validator';

export enum JiraMetricCategory {
  ISSUES = 'issues',
  SPRINTS = 'sprints',
  VELOCITY = 'velocity',
  WORKLOAD = 'workload',
  TIME_TRACKING = 'time_tracking',
  STATUS = 'status',
  TEAM = 'team',
}

export class JiraMetricDto {
  @IsString()
  metricName: string;

  @IsNumber()
  value: number;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsDate()
  timestamp: Date;

  @IsEnum(JiraMetricCategory)
  category: JiraMetricCategory;

  @IsObject()
  metadata: Record<string, any>;
}
