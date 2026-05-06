process.env.ADMIN_API_KEY ??= "test-admin-api-key-123456";
process.env.TELEGRAM_WEBHOOK_SECRET ??= "test-webhook-secret-123456";
process.env.DATABASE_URL ??=
  "postgresql://outreach:outreach@localhost:5432/outreach?schema=public";
process.env.REDIS_URL ??= "redis://127.0.0.1:6379";
