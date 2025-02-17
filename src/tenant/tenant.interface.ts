export interface TenantConfig {
    id: string;
    name: string;
    integrations: {
        github?: {
            token: string;
            organization: string;
        };
    };
}