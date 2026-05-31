import type { Inventory } from "@aria/types";
import type { InstallationNoteFormValues } from "./installation-note.schema";

export const INSTALLATION_NOTE_PAGE_SIZE = 25;

export function buildInstallationNoteListInput(params: {
	search: string;
	status: "all" | Inventory.InstallationNoteStatus;
	company: string;
	deliveryNoteId: string;
	pageIndex: number;
	pageSize: number;
	sortBy: Inventory.InstallationNoteSortBy;
	sortDirection: "asc" | "desc";
}): Inventory.ListInstallationNotesInput {
	return {
		skip: Math.max(0, params.pageIndex) * params.pageSize,
		take: params.pageSize,
		search: params.search.trim() || undefined,
		status: params.status === "all" ? undefined : params.status,
		company: params.company.trim() || undefined,
		deliveryNoteId: params.deliveryNoteId || undefined,
		sortBy: params.sortBy,
		sortDirection: params.sortDirection,
	};
}

export function toDateInputValue(value?: Date | string | null): string {
	if (!value) return "";
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toISOString().slice(0, 10);
}

function toNullableString(value: string | undefined): string | null {
	if (!value) return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function toNullableDate(value: string | undefined): Date | null {
	if (!value) return null;
	return new Date(`${value}T00:00:00.000Z`);
}

export function toInstallationNoteMutationInput(
	values: InstallationNoteFormValues,
): Omit<Inventory.CreateInstallationNoteInput, "id"> {
	return {
		seriesPattern: values.seriesPattern?.trim() || undefined,
		installationDate: toNullableDate(values.installationDate) ?? new Date(),
		installationTime: toNullableString(values.installationTime),
		customer: values.customer.trim(),
		customerName: toNullableString(values.customerName),
		customerAddress: toNullableString(values.customerAddress),
		contactPerson: toNullableString(values.contactPerson),
		territory: values.territory.trim(),
		customerGroup: toNullableString(values.customerGroup),
		company: values.company.trim(),
		status: values.status,
		deliveryNoteId: values.deliveryNoteId || null,
		remarks: toNullableString(values.remarks),
		items: values.items.map((item) => ({
			itemId: item.itemId,
			serialNoId: item.serialNoId || null,
			description: toNullableString(item.description),
			installedQty: item.installedQty,
		})),
	};
}

export function toInstallationNoteFormValues(note: {
	seriesPattern: string;
	installationDate: Date | string;
	installationTime?: string | null;
	customer: string;
	customerName?: string | null;
	customerAddress?: string | null;
	contactPerson?: string | null;
	territory: string;
	customerGroup?: string | null;
	company: string;
	status: Inventory.InstallationNoteStatus;
	deliveryNoteId?: string | null;
	remarks?: string | null;
	items: Array<{
		id: string;
		itemId: string;
		serialNoId?: string | null;
		description?: string | null;
		installedQty: number;
	}>;
}): InstallationNoteFormValues {
	return {
		seriesPattern: note.seriesPattern,
		installationDate: toDateInputValue(note.installationDate),
		installationTime: note.installationTime?.slice(0, 5) ?? "",
		customer: note.customer,
		customerName: note.customerName ?? "",
		customerAddress: note.customerAddress ?? "",
		contactPerson: note.contactPerson ?? "",
		territory: note.territory,
		customerGroup: note.customerGroup ?? "",
		company: note.company,
		status: note.status,
		deliveryNoteId: note.deliveryNoteId ?? "",
		remarks: note.remarks ?? "",
		items:
			note.items.length > 0
				? note.items.map((item) => ({
						id: item.id,
						itemId: item.itemId,
						serialNoId: item.serialNoId ?? "",
						description: item.description ?? "",
						installedQty: item.installedQty,
					}))
				: [
						{
							itemId: "",
							serialNoId: "",
							description: "",
							installedQty: 1,
						},
					],
	};
}

export function buildInstallationNoteFromDeliveryNote(input: {
	deliveryNote: {
		id: string;
		customer: string;
		company: string;
		items: Array<{
			itemCode: string;
			description?: string | null;
		}>;
	};
	serialNos: Array<{
		id: string;
		itemId: string;
		itemCode: string;
	}>;
}): Pick<
	InstallationNoteFormValues,
	"customer" | "customerName" | "company" | "deliveryNoteId" | "items"
> {
	const descriptionsByItemCode = new Map(
		input.deliveryNote.items.map((item) => [
			item.itemCode,
			item.description ?? "",
		]),
	);

	return {
		customer: input.deliveryNote.customer,
		customerName: input.deliveryNote.customer,
		company: input.deliveryNote.company,
		deliveryNoteId: input.deliveryNote.id,
		items:
			input.serialNos.length > 0
				? input.serialNos.map((serial) => ({
						itemId: serial.itemId,
						serialNoId: serial.id,
						description: descriptionsByItemCode.get(serial.itemCode) ?? "",
						installedQty: 1,
					}))
				: [
						{
							itemId: "",
							serialNoId: "",
							description: "",
							installedQty: 1,
						},
					],
	};
}

export function formatInstallationNoteStatus(
	status: Inventory.InstallationNoteStatus,
): string {
	switch (status) {
		case "IN_PROGRESS":
			return "In Progress";
		default:
			return status.charAt(0) + status.slice(1).toLowerCase();
	}
}

export function getInstallationNoteStatusBadgeClass(
	status: Inventory.InstallationNoteStatus,
): string {
	switch (status) {
		case "IN_PROGRESS":
			return "bg-amber-100 text-amber-700";
		case "COMPLETED":
			return "bg-emerald-100 text-emerald-700";
		case "CANCELLED":
			return "bg-rose-100 text-rose-700";
		default:
			return "bg-muted text-muted-foreground";
	}
}

export function formatRelativeAge(date: Date): string {
	const now = Date.now();
	const diffMs = Math.max(0, now - date.getTime());
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	const diffMonths = Math.floor(diffDays / 30);
	const diffYears = Math.floor(diffDays / 365);

	if (diffYears >= 1) return `${diffYears} y`;
	if (diffMonths >= 1) return `${diffMonths} m`;
	if (diffDays >= 1) return `${diffDays} d`;
	return "Today";
}
