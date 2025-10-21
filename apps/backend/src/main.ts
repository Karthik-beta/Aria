import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as trpcExpress from '@trpc/server/adapters/express';
import { TrpcService } from './trpc/trpc.service';
import { TrpcContext } from './trpc/trpc.context';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Get tRPC services from DI container
  const trpcService = app.get(TrpcService);
  const trpcContext = app.get(TrpcContext);

  // Create tRPC router
  const appRouter = trpcService.getAppRouter();

  // Mount tRPC adapter at /trpc
  app.use(
    '/trpc',
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext: () => trpcContext,
    }),
  );

  await app.listen(process.env.PORT ?? 3001);
  console.log(`Server running on http://localhost:${process.env.PORT ?? 3001}`);
  console.log(
    `tRPC endpoint: http://localhost:${process.env.PORT ?? 3001}/trpc`,
  );
}
void bootstrap();
