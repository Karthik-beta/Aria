import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
    // the main entry for your schema
    schema: 'prisma/schema.prisma',

    // where migrations should be generated
    migrations: {
        path: 'prisma/migrations',
    },

    // The database URL - moved from schema.prisma datasource block per Prisma 7 requirements
    datasource: {
        url: env('DATABASE_URL'),
    },
});
