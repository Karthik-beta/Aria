import { Module, Global } from '@nestjs/common';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './auth.config';
import { AuthService } from './auth.service';

/**
 * Authentication module using Better Auth
 *
 * @remarks
 * Provides authentication services throughout the application.
 *
 * CRITICAL: By default, Better Auth NestJS module does NOT apply a global guard.
 * Routes are public by default. Use @UseGuards(AuthGuard) to protect specific routes.
 *
 * Configuration options (per current TypeScript definitions):
 * - disableTrustedOriginsCors: false - Let Better Auth add CORS for trusted origins
 * - disableBodyParser: false - Better Auth will re-add necessary body parsers
 * - disableGlobalAuthGuard: true - Don't register AuthGuard globally via APP_GUARD
 *
 * Using object-based signature per deprecation warning.
 */
@Global()
@Module({
  imports: [
    // Configure Better Auth for NestJS using object-based signature
    // AuthModule.forRoot({ auth, ...options })
    BetterAuthModule.forRoot({
      auth,
      disableTrustedOriginsCors: false,
      disableBodyParser: false,
      disableGlobalAuthGuard: true,
    }),
  ],
  providers: [AuthService],
  exports: [AuthService, BetterAuthModule],
})
export class AuthModule {}
