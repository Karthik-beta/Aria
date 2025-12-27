import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client.js';
import { RoleService, PermissionService } from '../role-permission.service';

describe('RoleService', () => {
  let service: RoleService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      role: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      rolePermission: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RoleService, { provide: PrismaClient, useValue: mockPrisma }],
    }).compile();

    service = module.get<RoleService>(RoleService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRoleByKey', () => {
    it('should return role when found', async () => {
      const mockRole = { id: '1', key: 'manager', name: 'Manager', level: 5 };
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);

      const result = await service.getRoleByKey('manager');

      expect(result).toEqual(mockRole);
      expect(mockPrisma.role.findUnique).toHaveBeenCalledWith({
        where: { key: 'manager' },
      });
    });

    it('should return null when role not found', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(null);

      const result = await service.getRoleByKey('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('listRoles', () => {
    it('should return all roles ordered by level desc', async () => {
      const mockRoles = [
        { id: '1', key: 'admin', level: 10 },
        { id: '2', key: 'manager', level: 5 },
      ];
      mockPrisma.role.findMany.mockResolvedValue(mockRoles);

      const result = await service.listRoles();

      expect(result).toEqual(mockRoles);
      expect(mockPrisma.role.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ level: 'desc' }, { name: 'asc' }],
      });
    });

    it('should filter by isSystem flag', async () => {
      mockPrisma.role.findMany.mockResolvedValue([]);

      await service.listRoles({ isSystem: true });

      expect(mockPrisma.role.findMany).toHaveBeenCalledWith({
        where: { isSystem: true },
        orderBy: [{ level: 'desc' }, { name: 'asc' }],
      });
    });

    it('should filter by search term', async () => {
      mockPrisma.role.findMany.mockResolvedValue([]);

      await service.listRoles({ search: 'admin' });

      expect(mockPrisma.role.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { key: { contains: 'admin', mode: 'insensitive' } },
              { name: { contains: 'admin', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });
  });

  describe('createRole', () => {
    it('should create a new role', async () => {
      const roleData = {
        key: 'custom_role',
        name: 'Custom Role',
        level: 3,
        description: 'A custom role',
      };
      mockPrisma.role.create.mockResolvedValue({ id: '1', ...roleData });

      const result = await service.createRole(roleData);

      expect(result).toHaveProperty('id');
      expect(mockPrisma.role.create).toHaveBeenCalledWith({
        data: roleData,
      });
    });
  });

  describe('updateRole', () => {
    it('should update an existing role', async () => {
      const mockRole = { id: '1', key: 'manager', isSystem: false };
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.role.update.mockResolvedValue({
        ...mockRole,
        name: 'Updated Manager',
      });

      const result = await service.updateRole('1', { name: 'Updated Manager' });

      expect(result.name).toBe('Updated Manager');
      expect(mockPrisma.role.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { name: 'Updated Manager' },
      });
    });

    it('should throw NotFoundException when role does not exist', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(null);

      await expect(service.updateRole('999', { name: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteRole', () => {
    it('should delete a non-system role', async () => {
      const mockRole = { id: '1', key: 'custom_role', isSystem: false };
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.role.delete.mockResolvedValue(mockRole);

      await service.deleteRole('1');

      expect(mockPrisma.role.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should throw error when trying to delete system role', async () => {
      const mockRole = { id: '1', key: 'admin', isSystem: true };
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);

      await expect(service.deleteRole('1')).rejects.toThrow(
        'Cannot delete system roles',
      );
    });

    it('should throw NotFoundException when role does not exist', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(null);

      await expect(service.deleteRole('999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('assignPermissions', () => {
    it('should replace existing permissions', async () => {
      mockPrisma.rolePermission.deleteMany.mockResolvedValue({});
      mockPrisma.rolePermission.createMany.mockResolvedValue({});

      await service.assignPermissions('role1', ['perm1', 'perm2']);

      expect(mockPrisma.rolePermission.deleteMany).toHaveBeenCalledWith({
        where: { roleId: 'role1' },
      });
      expect(mockPrisma.rolePermission.createMany).toHaveBeenCalledWith({
        data: [
          { roleId: 'role1', permissionId: 'perm1' },
          { roleId: 'role1', permissionId: 'perm2' },
        ],
      });
    });

    it('should handle empty permission list', async () => {
      mockPrisma.rolePermission.deleteMany.mockResolvedValue({});

      await service.assignPermissions('role1', []);

      expect(mockPrisma.rolePermission.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.rolePermission.createMany).not.toHaveBeenCalled();
    });
  });

  describe('addPermission', () => {
    it('should add a single permission to role', async () => {
      mockPrisma.rolePermission.create.mockResolvedValue({});

      await service.addPermission('role1', 'perm1');

      expect(mockPrisma.rolePermission.create).toHaveBeenCalledWith({
        data: { roleId: 'role1', permissionId: 'perm1' },
      });
    });
  });

  describe('removePermission', () => {
    it('should remove a permission from role', async () => {
      mockPrisma.rolePermission.delete.mockResolvedValue({});

      await service.removePermission('role1', 'perm1');

      expect(mockPrisma.rolePermission.delete).toHaveBeenCalledWith({
        where: {
          roleId_permissionId: {
            roleId: 'role1',
            permissionId: 'perm1',
          },
        },
      });
    });
  });
});

describe('PermissionService', () => {
  let service: PermissionService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      permission: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionService,
        { provide: PrismaClient, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PermissionService>(PermissionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPermissionByKey', () => {
    it('should return permission when found', async () => {
      const mockPerm = { id: '1', key: 'system:user.read' };
      mockPrisma.permission.findUnique.mockResolvedValue(mockPerm);

      const result = await service.getPermissionByKey('system:user.read');

      expect(result).toEqual(mockPerm);
    });
  });

  describe('listPermissions', () => {
    it('should return all permissions', async () => {
      const mockPerms = [
        { id: '1', key: 'system:user.read' },
        { id: '2', key: 'app:crm:lead.read' },
      ];
      mockPrisma.permission.findMany.mockResolvedValue(mockPerms);

      const result = await service.listPermissions();

      expect(result).toEqual(mockPerms);
    });

    it('should filter by system scope', async () => {
      mockPrisma.permission.findMany.mockResolvedValue([]);

      await service.listPermissions({ scope: 'system' });

      expect(mockPrisma.permission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: { startsWith: 'system:' } },
        }),
      );
    });

    it('should filter by app scope', async () => {
      mockPrisma.permission.findMany.mockResolvedValue([]);

      await service.listPermissions({ scope: 'app' });

      expect(mockPrisma.permission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: { startsWith: 'app:' } },
        }),
      );
    });
  });

  describe('matchesPattern', () => {
    it('should match exact permission', () => {
      const result = service.matchesPattern(
        'system:user.read',
        'system:user.read',
      );

      expect(result).toBe(true);
    });

    it('should match system wildcard', () => {
      const result = service.matchesPattern('system:user.delete', 'system:*');

      expect(result).toBe(true);
    });

    it('should match app wildcard', () => {
      const result = service.matchesPattern('app:crm:lead.read', 'app:crm:*');

      expect(result).toBe(true);
    });

    it('should match entity wildcard', () => {
      const result = service.matchesPattern(
        'entity:crm:lead.update',
        'entity:crm:lead.*',
      );

      expect(result).toBe(true);
    });

    it('should not match different permissions', () => {
      const result = service.matchesPattern(
        'system:user.read',
        'system:role.read',
      );

      expect(result).toBe(false);
    });

    it('should not match wrong app in wildcard', () => {
      const result = service.matchesPattern(
        'app:inventory:item.read',
        'app:crm:*',
      );

      expect(result).toBe(false);
    });
  });
});
