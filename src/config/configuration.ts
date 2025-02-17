export default () => ({
    port: Number(process.env.PORT) || 3005,
    database: {
        url: process.env.DATABASE_URL || '',
    },
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
    },
    github: {
        token: process.env.GITHUB_TOKEN || '',
        organization: process.env.GITHUB_ORGANIZATION || '',
    },
    zamolxis: {
        enabled: process.env.ZAMOLXIS_API_ENABLED === 'false',
        apiUrl: process.env.ZAMOLXIS_API_URL,
        apiToken: process.env.ZAMOLXIS_API_TOKEN,
    }
});