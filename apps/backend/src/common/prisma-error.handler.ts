import {
	BadRequestException,
	ConflictException,
	NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";

/**
 * Maps Prisma known request errors to NestJS HTTP exceptions.
 *
 * @remarks
 * Centralizes P2002 (unique constraint), P2025 (record not found),
 * P2003 (foreign key), and P2014 (required relation) error handling.
 * Non-Prisma errors are re-thrown unchanged.
 *
 * @param error - The error caught from a Prisma operation.
 * @returns Never — always throws.
 */
export function handlePrismaError(error: unknown): never {
	if (error instanceof Prisma.PrismaClientKnownRequestError) {
		switch (error.code) {
			case "P2002": {
				const target =
					(error.meta?.target as string[] | undefined)?.join(", ") ?? "record";
				throw new ConflictException(
					`A record with this ${target} already exists`,
				);
			}
			case "P2025": {
				const cause = (error.meta?.cause as string | undefined) ?? "Record";
				throw new NotFoundException(`${cause} not found`);
			}
			case "P2003":
				throw new BadRequestException("Related record not found");
			case "P2014":
				throw new BadRequestException("Required relation missing");
		}
	}
	throw error;
}
