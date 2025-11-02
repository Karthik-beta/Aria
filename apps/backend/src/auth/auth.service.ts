import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { auth } from './auth.config';

// Import the singleton Prisma client
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Authentication service for managing users and default account creation
 *
 * @remarks
 * - Creates default admin user on startup using better-auth API
 * - Credentials sourced from environment variables
 */
@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly prisma = prisma;

  async onModuleInit() {
    // Create default user in both development and production for testing
    await this.createDefaultUser();
  }

  /**
   * Create default admin user from environment variables
   *
   * @remarks
   * Uses better-auth's sign-up endpoint via internal fetch to ensure proper password hashing.
   * Reads DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD, and DEFAULT_ADMIN_EMAIL
   * from environment. Skips if user already exists.
   */
  async createDefaultUser() {
    const username = process.env.DEFAULT_ADMIN_USERNAME;
    const password = process.env.DEFAULT_ADMIN_PASSWORD;
    const email = process.env.DEFAULT_ADMIN_EMAIL;
    const name = process.env.DEFAULT_ADMIN_NAME || 'Administrator';

    if (!username || !password || !email) {
      this.logger.warn(
        'Default admin credentials not configured. Skipping user creation. ' +
          'Set DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD, and DEFAULT_ADMIN_EMAIL.',
      );
      return;
    }

    try {
      // Wait for database to be ready
      await this.prisma.$connect();

      // Check if user already exists
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [{ username }, { email }],
        },
      });

      if (existingUser) {
        this.logger.log(`Default admin user already exists: ${username}`);
        return;
      }

      // Create user via better-auth's Request API
      // Username plugin uses /sign-up/email endpoint with username field
      const request = new Request(
        `${process.env.BETTER_AUTH_URL || 'http://localhost:3001'}/api/auth/sign-up/email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username,
            password,
            email,
            name,
          }),
        },
      );

      const response = await auth.handler(request);

      if (response.ok) {
        this.logger.log(`Default admin user created successfully: ${username}`);
      } else {
        const responseText = await response.text();
        this.logger.error(
          `Failed to create admin user via better-auth: ${response.status}`,
          responseText,
        );
      }
    } catch (error: any) {
      // Log error but don't crash the application
      this.logger.error(
        'Failed to create default admin user (non-critical):',
        error?.message || error,
      );
    }
  }

  async onModuleDestroy() {
    try {
      await this.prisma.$disconnect();
    } catch (error) {
      this.logger.error('Error disconnecting from database:', error);
    }
  }
}
