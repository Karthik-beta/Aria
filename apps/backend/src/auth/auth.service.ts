import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from 'db';
import * as bcrypt from 'bcrypt';

/**
 * Authentication service for managing users and default account creation
 *
 * @remarks
 * - Creates default admin user on startup in production
 * - Credentials sourced from environment variables
 */
@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly prisma = new PrismaClient();

  async onModuleInit() {
    // Only create default user in production
    if (process.env.NODE_ENV === 'production') {
      await this.createDefaultUser();
    }
  }

  /**
   * Create default admin user from environment variables
   *
   * @remarks
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

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = await this.prisma.user.create({
        data: {
          username,
          email,
          name,
          emailVerified: true,
        },
      });

      // Create credential account
      await this.prisma.account.create({
        data: {
          userId: user.id,
          accountId: user.id,
          providerId: 'credential',
          password: hashedPassword,
        },
      });

      this.logger.log(`Default admin user created successfully: ${username}`);
    } catch (error) {
      this.logger.error('Failed to create default admin user', error);
    }
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
