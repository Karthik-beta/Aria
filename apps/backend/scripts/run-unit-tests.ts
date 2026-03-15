import { spawn } from "node:child_process";
import { once } from "node:events";
import { readdir, rm } from "node:fs/promises";
import * as path from "node:path";

const projectRoot = process.cwd();
const bunExecutable = process.execPath;
const testEnv = {
	...process.env,
	NODE_ENV: "test",
	BETTER_AUTH_SECRET: "test-secret",
};

async function runCommand(args: string[], retries = 0) {
	let attempt = 0;

	while (attempt <= retries) {
		const subprocess = spawn(bunExecutable, args, {
			cwd: projectRoot,
			env: testEnv,
			stdio: "inherit",
		});

		const [exitCode] = await once(subprocess, "close");
		if (exitCode === 0) {
			return;
		}

		attempt += 1;
		if (attempt > retries) {
			throw new Error(
				`Command failed with exit code ${exitCode}: bun ${args.join(" ")}`,
			);
		}

		await new Promise((resolve) => {
			setTimeout(resolve, 250 * attempt);
		});
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

async function main() {
	try {
		await rm(tempDir, { recursive: true, force: true });

		// Build and test run concurrently in Turborepo; retry avoids transient Prisma generate races.
		await runCommand(["run", "prisma:generate"], 2);

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
}

main().catch((error) => {
	process.stderr.write(`${error}\n`);
	process.exitCode = 1;
});
