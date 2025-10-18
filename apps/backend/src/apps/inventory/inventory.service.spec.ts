import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../../shared/prisma.service';

describe('InventoryService', () => {
  let service: InventoryService;
  const prismaServiceMock = {
    inventoryItem: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(null),
    },
  } as unknown as PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prismaServiceMock },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
