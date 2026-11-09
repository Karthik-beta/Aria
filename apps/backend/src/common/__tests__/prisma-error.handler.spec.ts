import {
	BadRequestException,
	ConflictException,
	NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { handlePrismaError } from "../prisma-error.handler";

describe("handlePrismaError", () => {
	it("throws ConflictException for P2002 (unique constraint)", () => {
		const error = new Prisma.PrismaClientKnownRequestError(
			"Unique constraint failed",
			{ code: "P2002", clientVersion: "5.0.0", meta: { target: ["name"] } },
		);

		expect(() => handlePrismaError(error)).toThrow(ConflictException);
		expect(() => handlePrismaError(error)).toThrow(/name.*already exists/i);
	});

	it("throws NotFoundException for P2025 (record not found)", () => {
		const error = new Prisma.PrismaClientKnownRequestError("Record not found", {
			code: "P2025",
			clientVersion: "5.0.0",
			meta: { cause: "Record to update not found" },
		});

		expect(() => handlePrismaError(error)).toThrow(NotFoundException);
		expect(() => handlePrismaError(error)).toThrow(/not found/i);
	});

	it("throws BadRequestException for P2003 (foreign key)", () => {
		const error = new Prisma.PrismaClientKnownRequestError(
			"Foreign key constraint failed",
			{ code: "P2003", clientVersion: "5.0.0" },
		);

		expect(() => handlePrismaError(error)).toThrow(BadRequestException);
		expect(() => handlePrismaError(error)).toThrow(/related record not found/i);
	});

	it("throws BadRequestException for P2014 (required relation)", () => {
		const error = new Prisma.PrismaClientKnownRequestError(
			"Required relation missing",
			{ code: "P2014", clientVersion: "5.0.0" },
		);

		expect(() => handlePrismaError(error)).toThrow(BadRequestException);
		expect(() => handlePrismaError(error)).toThrow(/required relation/i);
	});

	it("re-throws non-Prisma errors unchanged", () => {
		const error = new Error("some other error");
		expect(() => handlePrismaError(error)).toThrow(error);
	});

	it("re-throws unknown Prisma error codes unchanged", () => {
		const error = new Prisma.PrismaClientKnownRequestError("Unknown code", {
			code: "P9999",
			clientVersion: "5.0.0",
		});
		expect(() => handlePrismaError(error)).toThrow(error);
	});

	it("handles P2002 with array target", () => {
		const error = new Prisma.PrismaClientKnownRequestError(
			"Unique constraint failed",
			{
				code: "P2002",
				clientVersion: "5.0.0",
				meta: { target: ["email", "organizationId"] },
			},
		);

		expect(() => handlePrismaError(error)).toThrow(ConflictException);
		expect(() => handlePrismaError(error)).toThrow(/email, organizationId/i);
	});

	it("handles P2025 with no meta cause", () => {
		const error = new Prisma.PrismaClientKnownRequestError("Record not found", {
			code: "P2025",
			clientVersion: "5.0.0",
		});

		expect(() => handlePrismaError(error)).toThrow(NotFoundException);
		expect(() => handlePrismaError(error)).toThrow(/record not found/i);
	});
});
