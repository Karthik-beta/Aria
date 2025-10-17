import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as trpcExpress from '@trpc/server/adapters/express';
import { TrpcService } from './trpc/trpc.service';
import { TrpcContext } from './trpc/trpc.context';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Server running on http://localhost:${process.env.PORT ?? 3000}`);
  console.log(
    `tRPC endpoint: http://localhost:${process.env.PORT ?? 3000}/trpc`,
  );
}
void bootstrap();
