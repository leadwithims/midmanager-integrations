src/
│
├── config/
│   ├── configuration.ts             # Environment configuration
│   └── validation.schema.ts         # Config validation schema
│
├── integrations/
│   ├── github/
│   │   ├── dto/
│   │   │   ├── github-webhook.dto.ts
│   │   │   └── github-metrics.dto.ts
│   │   ├── github.module.ts
│   │   ├── github.service.ts
│   │   └── github.interface.ts
│   │
│   ├── jira/
│   │   ├── dto/
│   │   │   ├── jira-issue.dto.ts
│   │   │   └── jira-metrics.dto.ts
│   │   ├── jira.module.ts
│   │   ├── jira.service.ts
│   │   └── jira.interface.ts
│   │
│   ├── bamboohr/
│   │   ├── dto/
│   │   │   ├── employee.dto.ts
│   │   │   └── time-off.dto.ts
│   │   ├── bamboohr.module.ts
│   │   ├── bamboohr.service.ts
│   │   └── bamboohr.interface.ts
│   │
│   └── javelo/
│       ├── dto/
│       │   ├── performance.dto.ts
│       │   └── review.dto.ts
│       ├── javelo.module.ts
│       ├── javelo.service.ts
│       └── javelo.interface.ts
│
├── common/
│   ├── decorators/
│   │   ├── tenant.decorator.ts
│   │   └── auth.decorator.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── guards/
│   │   ├── tenant.guard.ts
│   │   └── auth.guard.ts
│   ├── interceptors/
│   │   └── logging.interceptor.ts
│   └── middleware/
│       └── tenant-context.middleware.ts
│
├── prisma/
│   ├── schema.prisma               # Your existing Prisma schema
│   └── migrations/
│
├── queue/
│   ├── queue.module.ts
│   └── processors/
│       ├── github.processor.ts
│       ├── jira.processor.ts
│       ├── bamboohr.processor.ts
│       └── javelo.processor.ts
│
├── tenant/
│   ├── tenant.module.ts
│   ├── tenant.service.ts
│   └── tenant.interface.ts
│
├── app.module.ts
├── app.service.ts
└── main.ts
