import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRealtimeRecoveryHandlers } from "./provider";

describe("createRealtimeRecoveryHandlers", () => {
	const queryClient = {
		refetchQueries: vi.fn(),
	};
	let now = 1_000;

	beforeEach(() => {
		queryClient.refetchQueries.mockReset();
		now = 1_000;
	});

	it("refetches active queries when the tab becomes visible", () => {
		const recovery = createRealtimeRecoveryHandlers(queryClient, () => now);

		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "visible",
		});

		recovery.handleVisibilityChange();

		expect(queryClient.refetchQueries).toHaveBeenCalledWith({
			type: "active",
		});
	});

	it("throttles duplicate focus and visibility recoveries", () => {
		const recovery = createRealtimeRecoveryHandlers(queryClient, () => now);

		recovery.handleWindowFocus();
		recovery.handleWindowFocus();
		now += 500;
		recovery.handleWindowFocus();

		expect(queryClient.refetchQueries).toHaveBeenCalledTimes(1);

		now += 1_000;
		recovery.handleWindowFocus();

		expect(queryClient.refetchQueries).toHaveBeenCalledTimes(2);
	});

	it("only refetches after a websocket reconnect, not the initial socket open", () => {
		const recovery = createRealtimeRecoveryHandlers(queryClient, () => now);

		recovery.handleWsOpen();
		expect(queryClient.refetchQueries).not.toHaveBeenCalled();

		recovery.handleWsOpen();
		expect(queryClient.refetchQueries).toHaveBeenCalledTimes(1);
		expect(queryClient.refetchQueries).toHaveBeenCalledWith({
			type: "active",
		});
	});
});
