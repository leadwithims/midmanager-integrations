import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as JiraApi from 'jira-client';

@Injectable()
export class BaseJiraService {
    public readonly jira: JiraApi;

    constructor(protected readonly configService: ConfigService) {
        this.jira = new JiraApi({
            protocol: 'https',
            host: this.configService.get<string>('jira.host'),
            username: this.configService.get<string>('jira.username'),
            password: this.configService.get<string>('jira.apiToken'),
            apiVersion: '3',
            strictSSL: true
        });
    }
}