import { test as base, expect, type Page } from "@playwright/test";

const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL;
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD;

type TrpcEnvelope = {
	error?: { message?: string };
	result?: { data?: unknown };
};

type AuthResponse = {
	ok: boolean;
	status: number;
	text: string;
};

function backendUrl() {
	return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(
		/\/$/,
		"",
	);
}

/** Calls a real tRPC procedure using the authenticated browser context. */
export async function callTrpc<T>(
	page: Page,
	path: string,
	input: unknown,
	method: "query" | "mutation" = "query",
): Promise<T> {
	const request = page.context().request;
	const batchInput = input === undefined ? {} : { 0: input };
	const url = `${backendUrl()}/trpc/${path}?batch=1${
		method === "query"
			? `&input=${encodeURIComponent(JSON.stringify(batchInput))}`
			: ""
	}`;
	const response =
		method === "query"
			? await request.get(url)
			: await request.post(url, { data: batchInput });
	const rawBody = await response.text();
	let payload: TrpcEnvelope[];
	try {
		payload = JSON.parse(rawBody) as TrpcEnvelope[];
	} catch {
		throw new Error(`Invalid tRPC response for ${path}: ${rawBody}`);
	}
	const envelope = payload[0];
	if (
		!response.ok() ||
		envelope?.error ||
		envelope?.result?.data === undefined
	) {
		throw new Error(
			`tRPC ${method} ${path} failed (${response.status()}): ${
				envelope?.error?.message ?? rawBody
			}`,
		);
	}
	return envelope.result.data as T;
}

/** Calls a real Better Auth endpoint from the authenticated browser session. */
export async function callAuth<T>(
	page: Page,
	path: string,
	body?: unknown,
	method: "GET" | "POST" = "GET",
): Promise<T> {
	const result = await page.evaluate(
		async ({ url, requestMethod, requestBody }): Promise<AuthResponse> => {
			const response = await fetch(url, {
				method: requestMethod,
				credentials: "include",
				headers:
					requestBody === undefined
						? undefined
						: { "Content-Type": "application/json" },
				body:
					requestBody === undefined ? undefined : JSON.stringify(requestBody),
			});
			return {
				ok: response.ok,
				status: response.status,
				text: await response.text(),
			};
		},
		{
			url: `${backendUrl()}/api/auth${path}`,
			requestMethod: method,
			requestBody: body,
		},
	);
	if (!result.ok) {
		throw new Error(
			`Auth ${method} ${path} failed (${result.status}): ${result.text}`,
		);
	}
	try {
		return JSON.parse(result.text) as T;
	} catch {
		return result.text as T;
	}
}

export type E2ECompany = { id: string; name: string };
export type E2EFinanceBook = { id: string; name: string };
export type E2EOrganization = { id: string; name: string; slug: string };
export type E2EUser = { id: string; email: string; name: string };

export async function createE2ECompany(
	page: Page,
	name: string,
): Promise<E2ECompany> {
	return callTrpc<E2ECompany>(
		page,
		"company.createCompany",
		{ name },
		"mutation",
	);
}

export async function createE2EFinanceBook(
	page: Page,
	name: string,
): Promise<E2EFinanceBook> {
	return callTrpc<E2EFinanceBook>(
		page,
		"asset.createFinanceBook",
		{ name },
		"mutation",
	);
}

export async function deleteE2ECompany(page: Page, id: string) {
	await callTrpc(page, "company.deleteCompany", { id }, "mutation");
}

export async function deleteE2EFinanceBook(page: Page, id: string) {
	await callTrpc(page, "asset.deleteFinanceBook", { id }, "mutation");
}

export async function createE2EOrganization(
	page: Page,
	name: string,
	slug: string,
): Promise<E2EOrganization> {
	return callAuth<E2EOrganization>(
		page,
		"/organization/create",
		{ name, slug, keepCurrentActiveOrganization: true },
		"POST",
	);
}

export async function setActiveE2EOrganization(
	page: Page,
	organizationId: string,
) {
	await callAuth<E2EOrganization>(
		page,
		"/organization/set-active",
		{ organizationId },
		"POST",
	);
}

export async function deleteE2EOrganization(
	page: Page,
	organizationId: string,
) {
	await callAuth(page, "/organization/delete", { organizationId }, "POST");
}

export async function createE2EUser(
	page: Page,
	email: string,
	name: string,
	password: string,
): Promise<E2EUser> {
	const result = await callAuth<{ user: E2EUser }>(
		page,
		"/admin/create-user",
		{ email, name, password },
		"POST",
	);
	return result.user;
}

export async function inviteE2EOrganizationMember(
	page: Page,
	organizationId: string,
	email: string,
) {
	return callAuth<{ id: string }>(
		page,
		"/organization/invite-member",
		{ organizationId, email, role: "member" },
		"POST",
	);
}

export async function acceptE2EOrganizationInvitation(
	page: Page,
	invitationId: string,
) {
	return callAuth<{ member?: { id?: string } }>(
		page,
		"/organization/accept-invitation",
		{ invitationId },
		"POST",
	);
}

export async function removeE2EOrganizationMember(
	page: Page,
	organizationId: string,
	memberIdOrEmail: string,
) {
	return callAuth(
		page,
		"/organization/remove-member",
		{ organizationId, memberIdOrEmail },
		"POST",
	);
}

export async function deleteE2EUser(page: Page, userId: string) {
	return callAuth(page, "/admin/remove-user", { userId }, "POST");
}

/**
 * Authenticated browser fixture for Asset E2E tests.
 *
 * Credentials are deliberately supplied by the test environment rather than
 * committed to the repository. The fixture first visits the protected target
 * so the app's callback URL is preserved by the normal sign-in flow.
 */
export const test = base.extend({
	page: async ({ page }, use, testInfo) => {
		if (!DEFAULT_ADMIN_EMAIL || !DEFAULT_ADMIN_PASSWORD) {
			throw new Error(
				`Missing DEFAULT_ADMIN_EMAIL/DEFAULT_ADMIN_PASSWORD for ${testInfo.title}`,
			);
		}

		await page.goto("/asset/items", { waitUntil: "networkidle" });
		const backendBase = (
			process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
		).replace(/\/$/, "");
		const signInIdentifier = page.getByRole("textbox", {
			name: "Email or Username",
		});
		if (/\/auth\/sign-in/.test(page.url())) {
			await signInIdentifier.waitFor({ state: "visible" });
			await signInIdentifier.fill(DEFAULT_ADMIN_EMAIL);
			await page
				.getByRole("textbox", { name: "Password" })
				.fill(DEFAULT_ADMIN_PASSWORD);
			await page.getByRole("button", { name: "Sign In", exact: true }).click();
		}

		await expect
			.poll(
				async () => {
					const response = await page
						.context()
						.request.get(`${backendBase}/api/auth/get-session`);
					if (!response.ok()) return false;
					const payload = (await response.json()) as {
						session?: { activeOrganizationId?: string | null };
					} | null;
					return Boolean(payload?.session?.activeOrganizationId);
				},
				{ timeout: 15_000 },
			)
			.toBe(true);

		if (/\/auth\/sign-in/.test(page.url())) {
			await page.goto("/asset/items", { waitUntil: "networkidle" });
		}
		await expect(page).not.toHaveURL(/\/auth\/sign-in/);

		await use(page);
	},
});

export { expect };
