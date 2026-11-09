import { NextResponse } from "next/server";
import { collectDefaultMetrics, register } from "prom-client";

// Initialize default metrics collection
// This should only happen once
if (process.env.NODE_ENV !== "test") {
	try {
		collectDefaultMetrics({ prefix: "frontend_" });
	} catch (_e) {
		// Ignore error if metrics are already registered
	}
}

export async function GET() {
	try {
		const metrics = await register.metrics();
		return new NextResponse(metrics, {
			headers: {
				"Content-Type": register.contentType,
			},
		});
	} catch (_err) {
		return new NextResponse("Internal Server Error", { status: 500 });
	}
}
