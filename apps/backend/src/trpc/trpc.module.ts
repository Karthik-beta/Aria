import { Module } from '@nestjs/common';
import { TrpcContext } from './trpc.context';
import { TrpcService } from './trpc.service';

@Module({
  providers: [TrpcContext, TrpcService],
  exports: [TrpcContext, TrpcService],
})
export class TrpcModule {}
