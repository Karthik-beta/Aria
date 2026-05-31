const formatMessage = (level: string, message: string) =>
	`[${level}] ${message}`;

const tryInvoke = (
	method: keyof Console,
	message: string,
	args: unknown[],
	shouldLog: boolean,
) => {
	if (!shouldLog) {
		return;
	}

	const target = Reflect.get(globalThis, "console") as Console | undefined;
	const fn = target?.[method] as
		| ((message?: unknown, ...params: unknown[]) => void)
		| undefined;
	if (fn) {
		fn(message, ...args);
	}
};

/**
 * Minimal structured logger utility for the Aria monorepo.
 * Provides consistent formatting for application logs.
 */
export const logger = {
	info: (message: string, ...args: unknown[]) => {
		tryInvoke("info", formatMessage("INFO", message), args, true);
	},
	warn: (message: string, ...args: unknown[]) => {
		tryInvoke("warn", formatMessage("WARN", message), args, true);
	},
	error: (message: string, ...args: unknown[]) => {
		tryInvoke("error", formatMessage("ERROR", message), args, true);
	},
	debug: (message: string, ...args: unknown[]) => {
		tryInvoke(
			"debug",
			formatMessage("DEBUG", message),
			args,
			process.env.NODE_ENV !== "production",
		);
	},
};
