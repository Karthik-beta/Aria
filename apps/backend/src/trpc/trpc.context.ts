import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';

@Injectable()
export class TrpcContext {
  constructor(public readonly prisma: PrismaService) {}
}
