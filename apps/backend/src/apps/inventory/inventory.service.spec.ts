import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../../shared/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma';

describe('InventoryService', () => {
  let service: InventoryService;

  const mockItem = {
    id: 'clh1234567890',
    name: 'Test Product',
    sku: 'TEST-SKU',
    quantity: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrisma = {
    inventoryItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all items', async () => {
      mockPrisma.inventoryItem.findMany.mockResolvedValue([mockItem]);
      const result = await service.findAll();
      expect(result).toEqual([mockItem]);
      expect(mockPrisma.inventoryItem.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('create', () => {
    it('should create a new item', async () => {
      const input = { name: 'New Item', sku: 'NEW-SKU', quantity: 5 };
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(null);
      mockPrisma.inventoryItem.create.mockResolvedValue(mockItem);

      const result = await service.create(input);
      expect(result).toEqual(mockItem);
      expect(mockPrisma.inventoryItem.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if SKU exists', async () => {
      const input = { name: 'Test', sku: 'TEST-SKU', quantity: 1 };
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(mockItem);

      await expect(service.create(input)).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should update an item', async () => {
      const input = { id: mockItem.id, name: 'Updated Name' };
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.inventoryItem.update.mockResolvedValue({
        ...mockItem,
        name: 'Updated Name',
      });

      const result = await service.update(input);
      expect(result.name).toBe('Updated Name');
      expect(mockPrisma.inventoryItem.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if item does not exist', async () => {
      const input = { id: mockItem.id, name: 'Test' };
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(null);

      await expect(service.update(input)).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete an item', async () => {
      mockPrisma.inventoryItem.delete.mockResolvedValue(mockItem);

      const result = await service.delete(mockItem.id);
      expect(result).toEqual(mockItem);
      expect(mockPrisma.inventoryItem.delete).toHaveBeenCalledWith({
        where: { id: mockItem.id },
      });
    });

    it('should throw NotFoundException if item does not exist', async () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        { code: 'P2025', clientVersion: '1.0.0' },
      );
      mockPrisma.inventoryItem.delete.mockRejectedValue(error);

      await expect(service.delete(mockItem.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
