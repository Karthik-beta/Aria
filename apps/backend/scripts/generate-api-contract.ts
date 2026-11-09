/**
 * Generate API Contract Types
 *
 * Extracts tRPC procedure types from router definitions and generates
 * declaration files (.d.ts) for the api-contract package.
 *
 * This ensures the frontend always has up-to-date types without manual edits.
 *
 * Usage: bun run tsx apps/backend/scripts/generate-api-contract.ts [--write]
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..", "..", "..");
const API_CONTRACT_PATH = join(PROJECT_ROOT, "packages/api-contract/src");
const BACKEND_TRPC_PATH = join(PROJECT_ROOT, "apps/backend/src/apps");

interface ProcedureInfo {
	name: string;
	type: "query" | "mutation" | "subscription";
}

interface RouterInfo {
	name: string;
	sourcePath: string;
	destPath: string;
}

interface ProcessResult {
	routerName: string;
	totalProcedures: number;
	newProcedures: ProcedureInfo[];
	success: boolean;
	error?: string;
}

/**
 * Read a router file and extract procedure declarations
 */
function extractProcedures(content: string): ProcedureInfo[] {
	const procedures: ProcedureInfo[] = [];

	// Match: procedureName: ReturnType<typeof createProcedureNameProcedure>
	const returnTypePattern =
		/(\w+):\s*ReturnType<\s*typeof\s*(create\w+Procedure)\s*>/g;

	let match: RegExpExecArray | null = returnTypePattern.exec(content);
	while (match !== null) {
		const [, name, creatorName] = match;
		// Mutations: procedures that modify data (create, update, delete, log, export)
		const isMutation =
			creatorName.includes("Mutation") ||
			creatorName.includes("Export") ||
			creatorName.includes("Create") ||
			creatorName.includes("Update") ||
			creatorName.includes("Delete") ||
			creatorName.includes("Log");
		const type = isMutation
			? "mutation"
			: creatorName.includes("Subscription")
				? "subscription"
				: "query";

		procedures.push({ name, type });
		match = returnTypePattern.exec(content);
	}

	return procedures;
}

/**
 * Format a procedure declaration for .d.ts file
 */
function formatProcedureDeclaration(proc: ProcedureInfo): string {
	const typePrefix =
		proc.type === "mutation"
			? "TRPCMutationProcedure"
			: proc.type === "subscription"
				? "TRPCSubscriptionProcedure"
				: "TRPCQueryProcedure";

	return `	${proc.name}: ${typePrefix}<{
		input: unknown;
		output: unknown;
		meta: object;
	}>;`;
}

/**
 * Find procedures that are NOT in the existing .d.ts file
 */
function findNewProcedures(
	existingContent: string,
	newProcedures: ProcedureInfo[],
): ProcedureInfo[] {
	const existingNames = new Set<string>();

	// Extract existing procedure names from the .d.ts
	// Match patterns like: listItems: TRPCQueryProcedure<...>
	// or: createWarehouse: TRPCMutationProcedure<...>
	const procPattern = /^\s*(\w+):\s*TRPC\w+Procedure</gm;
	let match: RegExpExecArray | null = procPattern.exec(existingContent);

	while (match !== null) {
		existingNames.add(match[1]);
		match = procPattern.exec(existingContent);
	}

	return newProcedures.filter((p) => !existingNames.has(p.name));
}

/**
 * Insert new procedures into an existing .d.ts file
 *
 * Strategy: Find the closing "};" of the InventoryRouterInput type.
 * The structure is:
 *   type InventoryRouterInput = {
 *     ... procedures ...
 *   };
 *
 * Procedure blocks end with:
 *     meta: object;
 *   }>;
 *
 * Then comes a blank line, then:
 *   };
 *
 * So we look for "};" where:
 * 1. i-1 is "}>;" (closing of last procedure)
 * 2. i-2 includes "meta: object;" (last procedure's meta)
 * 3. Followed by "type InventoryRouterRoot"
 */
function insertProcedures(
	filePath: string,
	procedures: ProcedureInfo[],
): boolean {
	const content = readFileSync(filePath, "utf-8");
	const lines = content.split("\n");

	// Find the "};" that closes InventoryRouterInput
	let insertIndex = -1;
	for (let i = lines.length - 1; i >= 0; i--) {
		if (lines[i].trim() === "};") {
			// Check structure:
			// i:     "};"
			// i-1:   "}>;" (procedure close)
			// i-2:   "meta: object;" (procedure meta)
			// i-3:   "output: ..." (last output field)
			// i+1:   "" (blank line - optional)
			// i+2:   "type InventoryRouterRoot"
			const i_1 = lines[i - 1]?.trim() ?? "";
			const i_2 = lines[i - 2]?.trim() ?? "";

			if (i_1 === "}>;" && i_2.includes("meta: object;")) {
				// Verify followed by type InventoryRouterRoot (skip blank lines)
				for (let j = i + 1; j < lines.length && j < i + 6; j++) {
					if (lines[j].includes("type InventoryRouterRoot")) {
						insertIndex = i;
						break;
					}
					if (lines[j].trim() !== "") break;
				}
				if (insertIndex !== -1) break;
			}
		}
	}

	if (insertIndex === -1) {
		return false;
	}

	const newLines = procedures.map((p) => formatProcedureDeclaration(p));

	const finalLines = [
		...lines.slice(0, insertIndex),
		...newLines,
		"",
		...lines.slice(insertIndex),
	];

	writeFileSync(filePath, finalLines.join("\n"));
	return true;
}

/**
 * Process a single router and update its .d.ts file
 */
function processRouter(
	router: RouterInfo,
	shouldWrite: boolean,
): ProcessResult {
	if (!existsSync(router.sourcePath)) {
		return {
			routerName: router.name,
			totalProcedures: 0,
			newProcedures: [],
			success: false,
			error: "Source file not found",
		};
	}

	const content = readFileSync(router.sourcePath, "utf-8");
	const procedures = extractProcedures(content);

	if (!existsSync(router.destPath)) {
		return {
			routerName: router.name,
			totalProcedures: procedures.length,
			newProcedures: [],
			success: false,
			error: "Dest file not found",
		};
	}

	const existingContent = readFileSync(router.destPath, "utf-8");
	const newProcedures = findNewProcedures(existingContent, procedures);

	if (newProcedures.length === 0) {
		return {
			routerName: router.name,
			totalProcedures: procedures.length,
			newProcedures: [],
			success: true,
		};
	}

	if (shouldWrite) {
		const success = insertProcedures(router.destPath, newProcedures);
		return {
			routerName: router.name,
			totalProcedures: procedures.length,
			newProcedures,
			success,
			error: success ? undefined : "Insertion point not found",
		};
	}

	return {
		routerName: router.name,
		totalProcedures: procedures.length,
		newProcedures,
		success: true,
	};
}

/**
 * Main generation function
 */
function main(): number {
	const shouldWrite = process.argv.includes("--write");

	const routers: RouterInfo[] = [
		{
			name: "inventory",
			sourcePath: join(BACKEND_TRPC_PATH, "inventory/trpc/inventory.router.ts"),
			destPath: join(
				API_CONTRACT_PATH,
				"apps/inventory/trpc/inventory.router.d.ts",
			),
		},
		{
			name: "asset",
			sourcePath: join(BACKEND_TRPC_PATH, "asset/trpc/asset.router.ts"),
			destPath: join(API_CONTRACT_PATH, "apps/asset/trpc/asset.router.d.ts"),
		},
	];

	const results: ProcessResult[] = [];
	for (const router of routers) {
		results.push(processRouter(router, shouldWrite));
	}

	// Output results for CI visibility
	const allSuccess = results.every((r) => r.success);
	if (!allSuccess) {
		for (const result of results) {
			if (!result.success) {
				process.stderr.write(
					`[generate-api-contract] ${result.routerName}: ${result.error}\n`,
				);
			}
		}
	}

	return allSuccess ? 0 : 1;
}

const exitCode = main();
process.exit(exitCode);
