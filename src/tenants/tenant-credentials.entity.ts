import { Entity, Column } from 'typeorm';

@Entity()
export class TenantCredentials {
    @Column()
    tenantId: string;

    @Column('jsonb')
    jiraCredentials?: {
        host: string;
        username: string;
        apiToken: string;
    };

    @Column('jsonb')
    githubCredentials?: {
        token: string;
        organization: string;
    };

    @Column('jsonb')
    bamboohrCredentials?: {
        apiKey: string;
        subdomain: string;
    };

    @Column('jsonb')
    javeloCredentials?: {
        apiKey: string;
        baseUrl: string;
    };

    @Column()
    isActive: boolean;
}
