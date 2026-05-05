import {
	type CanActivate,
	type ExecutionContext,
	ForbiddenException,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import type { Reflector } from "@nestjs/core";

const PUBLIC_ROUTE_KEY = "public_route";

@Injectable()
export class PublicRouteGuard implements CanActivate {
	constructor(private reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const isPublic = this.reflector.getAllAndOverride<boolean>(
			PUBLIC_ROUTE_KEY,
			[context.getHandler(), context.getClass()],
		);

		if (isPublic) {
			return true;
		}

		return true;
	}
}

@Injectable()
export class ActiveUserGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest();
		const user = request.user;

		if (!user || !user.id) {
			throw new UnauthorizedException("No authenticated user");
		}

		if (user.banned) {
			throw new ForbiddenException("User account is banned");
		}

		return true;
	}
}
