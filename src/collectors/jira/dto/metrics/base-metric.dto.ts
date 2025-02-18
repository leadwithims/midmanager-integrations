import { IsString, IsNumber, IsDate, IsObject, IsOptional, IsEnum } from 'class-validator';
import { MetricCategory } from '../../constants/metrics.constants';

export class BaseMetricDto {
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