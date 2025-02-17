@Processor('github-sync')
export class GitHubProcessor {
    @Process('sync-metrics')
    async handleMetricsSync(job: Job<{ tenantId: string }>) {
        const { tenantId } = job.data;

        // Get tenant context
        const context = await this.tenantService.getTenantContext(tenantId);

        // Use Prisma with tenant context
        await this.prisma.$use(async (params, next) => {
            // Automatically add tenantId to all queries
            if (params.action === 'create' || params.action === 'update') {
                params.args.data = { ...params.args.data, tenantId };
            } else if (params.action === 'findMany' || params.action === 'findFirst') {
                params.args.where = { ...params.args.where, tenantId };
            }
            return next(params);
        });

        try {
            const metrics = await this.githubService.fetchUserContributions(tenantId, 'username');

            await this.prisma.engineeringMetric.create({
                data: {
                    tenantId,
                    metricName: 'github_contributions',
                    value: metrics.total,
                    unit: 'commits',
                    timestamp: new Date(),
                    category: 'engineering',
                    metadata: metrics,
                },
            });
        } catch (error) {
            // Log error with tenant context
            this.logger.error(`Error processing tenant ${tenantId}:`, error);
            throw error;
        }
    }
}
