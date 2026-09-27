import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx profile/prisma/seed.ts',
  },
  datasource: {
    url: env('PROFILE_DATABASE_URL'),
  },
});
