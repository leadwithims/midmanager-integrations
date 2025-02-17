import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { GithubModule } from './integrations/github/github.module';
import { JiraModule } from './integrations/jira/jira.module';
import { BambooHRModule } from './integrations/bamboohr/bamboohr.module';
import { JaveloModule } from './integrations/javelo/javelo.module';
import { TenantModule } from './tenant/tenant.module';
import { QueueModule } from './queue/queue.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
        BullModule.forRoot({
            redis: {
                host: process.env.REDIS_HOST,
                port: parseInt(process.env.REDIS_PORT, 10),
            },
        }),
        ScheduleModule.forRoot(),
        GithubModule,
        JiraModule,
        BambooHRModule,
        JaveloModule,
        TenantModule,
        QueueModule,
    ],
})
export class AppModule { }