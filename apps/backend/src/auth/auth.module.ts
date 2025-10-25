import { Module, Global } from '@nestjs/common';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './auth.config';
import { AuthService } from './auth.service';

/**
 * Authentication module using Better Auth
 *
 * @remarks
 * Provides authentication services throughout the application.
 * Only active in production environment.
 */
@Global()
@Module({
  imports: [
    // Configure Better Auth for NestJS
    BetterAuthModule.forRoot({ auth }),
  ],
  providers: [AuthService],
  exports: [AuthService, BetterAuthModule],
})
export class AuthModule {}
