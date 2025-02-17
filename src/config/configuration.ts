export default () => ({
    port: parseInt(process.env.PORT, 10) || 3000,
    database: {
        url: process.env.DATABASE_URL,
    },
    redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT, 10),
    },
    github: {
        token: process.env.GITHUB_TOKEN,
        webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
    },
    jira: {
        host: process.env.JIRA_HOST,
        username: process.env.JIRA_USERNAME,
        token: process.env.JIRA_TOKEN,
    },
    bamboohr: {
        apiKey: process.env.BAMBOOHR_API_KEY,
        subdomain: process.env.BAMBOOHR_SUBDOMAIN,
    },
    javelo: {
        apiKey: process.env.JAVELO_API_KEY,
        baseUrl: process.env.JAVELO_BASE_URL,
    },
    gcp: {
        projectId: process.env.GCP_PROJECT_ID,
        credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    },
});