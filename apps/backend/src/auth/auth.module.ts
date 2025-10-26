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
 *
 * CRITICAL: The NestJS Better Auth module registers an AuthGuard globally by default.
 * According to the official docs, we should disable this since we handle auth
 * protection in the frontend via AuthGuard component. Backend routes should be
 * accessible for auth endpoints to work.
 */
@Global()
@Module({
  imports: [
    // Configure Better Auth for NestJS
    // Disable global guard to allow auth endpoints to work
    BetterAuthModule.forRoot({
      auth,
      disableGlobalAuthGuard: true,
    }),
  ],
  providers: [AuthService],
  exports: [AuthService, BetterAuthModule],
})
export class AuthModule {}
