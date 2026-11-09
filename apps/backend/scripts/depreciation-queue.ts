import "dotenv/config";
import { DepreciationQueueClient } from "../src/apps/asset/depreciation/depreciation-queue.client";

const command = process.argv[2];
if (!["status", "pause", "resume"].includes(command ?? "")) {
	process.stderr.write(
		"Usage: bun run depreciation:queue -- status|pause|resume\n",
	);
	process.exit(2);
}

const queue = new DepreciationQueueClient();
try {
	if (command === "pause") {
		await queue.pause();
		process.stdout.write("Depreciation queue paused.\n");
	} else if (command === "resume") {
		await queue.resume();
		process.stdout.write("Depreciation queue resumed.\n");
	}
	process.stdout.write(`${JSON.stringify(await queue.status(), null, 2)}\n`);
} finally {
	await queue.onApplicationShutdown();
}
