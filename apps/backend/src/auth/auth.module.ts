import { Global, Module } from "@nestjs/common";
import { AuthService } from "./auth.service";

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
	providers: [AuthService],
	exports: [AuthService],
})
export class AuthModule {}
