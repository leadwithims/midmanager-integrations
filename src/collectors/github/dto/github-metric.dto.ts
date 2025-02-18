import { IsString, IsNumber, IsDate, IsObject, IsOptional, IsEnum } from 'class-validator';

export enum MetricCategory {
    REPOSITORY = 'repository',
    PULL_REQUESTS = 'pull_requests',
    COMMITS = 'commits',
    CODE_QUALITY = 'code_quality',
    COLLABORATION = 'collaboration',
    VELOCITY = 'velocity'
}

export class GitHubMetricDto {
    @IsString()
    metricName: string;

    @IsNumber()
    value: number;

    @IsString()
    @IsOptional()
    unit?: string;

    @IsDate()
    timestamp: Date;

    @IsEnum(MetricCategory)
    category: MetricCategory;

    @IsObject()
    metadata: Record<string, any>;
}
