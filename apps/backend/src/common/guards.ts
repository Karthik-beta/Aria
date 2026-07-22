import {
	type CanActivate,
	type ExecutionContext,
	ForbiddenException,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";

export { handlePrismaError } from "./prisma-error.handler";

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
