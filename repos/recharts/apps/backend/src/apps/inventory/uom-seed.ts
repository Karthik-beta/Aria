import { constants as fsConstants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const UOM_CSV_HEADERS = [
	"UOM Name",
	"Enabled",
	"Must be Whole Number",
] as const;

/**
 * Canonical UOM seed row parsed from the standard CSV file.
 */
export type UomSeedEntry = {
	name: string;
	disabled: boolean;
	isWholeNumber: boolean;
};

/**
 * Normalizes a UOM name for case-insensitive comparisons.
 *
 * @param name - Raw UOM name from the database or CSV.
 * @returns The trimmed, lowercased comparison key.
 */
export function normalizeUomName(name: string): string {
	return name.trim().toLowerCase();
}

function parseCsvLine(line: string): string[] {
	const values: string[] = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i += 1) {
		const char = line[i];
		const nextChar = line[i + 1];

		if (char === '"') {
			if (inQuotes && nextChar === '"') {
				current += '"';
				i += 1;
				continue;
			}

			inQuotes = !inQuotes;
			continue;
		}

		if (char === "," && !inQuotes) {
			values.push(current.trim());
			current = "";
			continue;
		}

		current += char;
	}

	values.push(current.trim());
	return values;
}

function parseBooleanFlag(
	value: string,
	fieldName: (typeof UOM_CSV_HEADERS)[number],
	lineNumber: number,
): boolean {
	if (value === "1" || value.toLowerCase() === "true") {
		return true;
	}

	if (value === "0" || value.toLowerCase() === "false") {
		return false;
	}

	throw new Error(
		`Invalid ${fieldName} value "${value}" at line ${lineNumber}. Expected 0/1.`,
	);
}

/**
 * Parses the standard UOM seed CSV into typed seed rows.
 *
 * The parser expects a header row with the canonical columns and then one
 * record per UOM. Duplicate names are collapsed using case-insensitive
 * matching, keeping the first occurrence.
 *
 * @param content - Raw CSV file contents.
 * @returns A de-duplicated array of UOM seed entries.
 * @throws {Error} When the CSV is empty, the header is malformed, a row has
 * the wrong shape, or a boolean flag is invalid.
 */
export function parseUomSeedCsv(content: string): UomSeedEntry[] {
	const lines = content
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

	if (lines.length === 0) {
		throw new Error("UOM seed CSV is empty");
	}

	const headerRow = parseCsvLine(lines[0]);
	if (headerRow.length !== UOM_CSV_HEADERS.length) {
		throw new Error("UOM seed CSV header is malformed");
	}

	const hasExpectedHeaders = UOM_CSV_HEADERS.every(
		(header, index) => headerRow[index] === header,
	);
	if (!hasExpectedHeaders) {
		throw new Error(
			`UOM seed CSV header mismatch. Expected: ${UOM_CSV_HEADERS.join(", ")}`,
		);
	}

	const entriesByName = new Map<string, UomSeedEntry>();

	for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
		const lineNumber = lineIndex + 1;
		const fields = parseCsvLine(lines[lineIndex]);
		if (fields.length !== UOM_CSV_HEADERS.length) {
			throw new Error(`Malformed UOM seed row at line ${lineNumber}`);
		}

		const [rawName, rawEnabled, rawWholeNumber] = fields;
		const name = rawName.trim();
		if (!name) {
			throw new Error(`UOM name is required at line ${lineNumber}`);
		}

		const enabled = parseBooleanFlag(
			rawEnabled,
			UOM_CSV_HEADERS[1],
			lineNumber,
		);
		const isWholeNumber = parseBooleanFlag(
			rawWholeNumber,
			UOM_CSV_HEADERS[2],
			lineNumber,
		);

		const normalized = normalizeUomName(name);
		if (!entriesByName.has(normalized)) {
			entriesByName.set(normalized, {
				name,
				disabled: !enabled,
				isWholeNumber,
			});
		}
	}

	return [...entriesByName.values()];
}

/**
 * Resolves the canonical UOM seed CSV path from known runtime locations.
 *
 * @returns The first matching CSV path found on disk.
 * @throws {Error} When the CSV cannot be located.
 */
export async function resolveUomSeedCsvPath(): Promise<string> {
	const pathCandidates = [
		resolve(process.cwd(), "apps/backend/prisma/seeds/data/uom.csv"),
		resolve(process.cwd(), "prisma/seeds/data/uom.csv"),
		resolve(__dirname, "../../../prisma/seeds/data/uom.csv"),
	];

	for (const candidate of pathCandidates) {
		try {
			await access(candidate, fsConstants.F_OK);
			return candidate;
		} catch {
			// Continue searching in other known runtime locations.
		}
	}

	throw new Error(
		[
			"Unable to locate UOM seed CSV in any of the expected locations.",
			`Tried: ${pathCandidates.join(", ")}`,
			"Check that you are running the backend from the monorepo workspace root or `apps/backend`, and that `apps/backend/prisma/seeds/data/uom.csv` exists.",
		].join(" "),
	);
}

/**
 * Loads and parses UOM seed rows from the canonical CSV file.
 *
 * @param csvPath - Optional explicit path, used mainly by tests.
 * @returns Parsed and normalized UOM seed entries.
 * @throws {Error} When the file cannot be read or parsed.
 */
export async function loadUomSeedEntriesFromCsv(
	csvPath?: string,
): Promise<UomSeedEntry[]> {
	const resolvedPath = csvPath ?? (await resolveUomSeedCsvPath());
	const content = await readFile(resolvedPath, "utf-8");
	return parseUomSeedCsv(content);
}
