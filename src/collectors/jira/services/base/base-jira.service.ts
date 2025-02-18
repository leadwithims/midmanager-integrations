import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as JiraApi from 'jira-client';
import { IJiraService } from '../../interfaces/services/jira-service.interface';

@Injectable()
export class BaseJiraService implements IJiraService {
    protected readonly logger: Logger;
    protected readonly jira: JiraApi;
    protected readonly baseUrl: string;

    constructor(
        protected readonly configService: ConfigService,
    ) {
        this.logger = new Logger(this.constructor.name);
        const host = this.configService.get<string>('jira.host');
        this.baseUrl = `https://${host}`;

        this.jira = new JiraApi({
            protocol: 'https',
            host,
            username: this.configService.get<string>('jira.username'),
            password: this.configService.get<string>('jira.apiToken'),
            apiVersion: '3',
            strictSSL: true
        });
    }

    getClient(): JiraApi {
        return this.jira;
    }

    getBaseUrl(): string {
        return this.baseUrl;
    }

    getAuth(): string {
        return Buffer.from(
            `${this.configService.get('jira.username')}:${this.configService.get('jira.apiToken')}`
        ).toString('base64');
    }

    protected async executeJiraQuery<T>(
        operation: () => Promise<T>,
        errorMessage: string
    ): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            this.logger.error(`${errorMessage}: ${error.message}`, error.stack);
            throw error;
        }
    }
}
