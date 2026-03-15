import { readdir, rm } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dir, "..");
const bunExecutable = process.execPath;
const testEnv = {
	...process.env,
	NODE_ENV: "test",
	BETTER_AUTH_SECRET: "test-secret",
};

async function runCommand(args: string[]) {
	const subprocess = Bun.spawn({
		cmd: [bunExecutable, ...args],
		cwd: projectRoot,
		env: testEnv,
		stdout: "inherit",
		stderr: "inherit",
	});

	const exitCode = await subprocess.exited;
	if (exitCode !== 0) {
		throw new Error(
			`Command failed with exit code ${exitCode}: bun ${args.join(" ")}`,
		);
	}
}

async function collectSpecFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const results = await Promise.all(
		entries.map(async (entry) => {
			const fullPath = path.join(dir, entry.name);

			if (entry.isDirectory()) {
				return collectSpecFiles(fullPath);
			}

			return entry.isFile() && entry.name.endsWith(".spec.js")
				? [fullPath]
				: [];
		}),
	);

	return results.flat().sort((left, right) => left.localeCompare(right));
}

const tempDir = path.join(projectRoot, ".test-dist");

try {
	await rm(tempDir, { recursive: true, force: true });

	// Prisma v7 client is generated to src/generated/prisma and must exist before tsc.
	await runCommand(["run", "prisma:generate"]);

	await runCommand([
		"x",
		"tsc",
		"-p",
		"tsconfig.spec.json",
		"--outDir",
		tempDir,
	]);

	const compiledSrcDir = path.join(tempDir, "src");
	const specFiles = await collectSpecFiles(compiledSrcDir);

	if (specFiles.length === 0) {
		throw new Error(`No compiled spec files found in ${compiledSrcDir}`);
	}

	await runCommand([
		"test",
		"--preload",
		path.join(projectRoot, "node_modules", "reflect-metadata", "Reflect.js"),
		...specFiles,
	]);
} finally {
	await rm(tempDir, { recursive: true, force: true });
}
