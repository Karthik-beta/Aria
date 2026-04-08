/**
 * Installation note sub-service.
 *
 * Manages the lifecycle of installation notes (DRAFT → IN_PROGRESS →
 * COMPLETED / CANCELLED) with serial-number status updates and
 * auto-incrementing series.
 *
 * @module InstallationNoteSubService
 * @see {@link https://docs.erpnext.com/docs/user/manual/en/stock/installation-note | ERPNext Installation Note}
 */
import type { Inventory } from "@aria/types";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import {
	allocateDocumentSeries,
	getSeriesSeedValue,
} from "../../../shared/document-series";
import type { PrismaService } from "../../../shared/prisma.service";
import { toInventoryInstallationNote } from "../inventory.types";
import {
	assertSerialNoStatusTransition,
	buildSerialNoTransactionLabel,
	INSTALLATION_NOTE_ALLOWED_STATUS_TRANSITIONS,
	installationNoteInclude,
	LIST_QUERY_TAKE_MAX,
	normalizeOptionalText,
	normalizePostingTime,
} from "./inventory-shared";

export class InstallationNoteSubService {
	constructor(private readonly prisma: PrismaService) {}

	private async lockInstallationNoteRow(
		tx: Prisma.TransactionClient,
		installationNoteId: string,
	): Promise<void> {
		const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
			SELECT id
			FROM installation_notes
			WHERE id = ${installationNoteId}
			FOR UPDATE
		`);

		if (rows.length === 0) {
			throw new NotFoundException(
				`Installation note with ID ${installationNoteId} not found`,
			);
		}
	}

	private async lockSerialNoRows(
		tx: Prisma.TransactionClient,
		serialNoIds: Array<string | null | undefined>,
	): Promise<void> {
		const uniqueIds = [...new Set(serialNoIds.map((id) => id?.trim() ?? ""))]
			.filter((id) => id.length > 0)
			.sort();

		if (uniqueIds.length === 0) {
			return;
		}

		await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
			SELECT id
			FROM serial_nos
			WHERE id IN (${Prisma.join(uniqueIds)})
			ORDER BY id
			FOR UPDATE
		`);
	}

	private getInstallationNoteOrderBy(
		sortBy: Inventory.InstallationNoteSortBy = "updatedAt",
		sortDirection: Prisma.SortOrder = "desc",
	): Prisma.InstallationNoteOrderByWithRelationInput[] {
		switch (sortBy) {
			case "createdAt":
				return [{ createdAt: sortDirection }, { series: "asc" }];
			case "series":
				return [{ series: sortDirection }, { updatedAt: "desc" }];
			case "installationDate":
				return [{ installationDate: sortDirection }, { series: "asc" }];
			case "customer":
				return [{ customer: sortDirection }, { series: "asc" }];
			case "status":
				return [{ status: sortDirection }, { series: "asc" }];
			case "company":
				return [{ company: sortDirection }, { series: "asc" }];
			default:
				return [{ updatedAt: sortDirection }, { series: "asc" }];
		}
	}

	private assertInstallationNoteStatusTransition(
		fromStatus: Inventory.InstallationNoteStatus,
		toStatus: Inventory.InstallationNoteStatus,
	): void {
		if (fromStatus === toStatus) {
			return;
		}

		const allowedTransitions =
			INSTALLATION_NOTE_ALLOWED_STATUS_TRANSITIONS[fromStatus];
		if (!allowedTransitions.includes(toStatus)) {
			throw new BadRequestException(
				`Cannot change installation note status from ${fromStatus} to ${toStatus}`,
			);
		}
	}

	// ============================================================================
	// Installation Note Methods
	// ============================================================================

	private normalizeInstallationNoteSeriesPattern(
		seriesPattern?: string | null,
	): string {
		const raw = seriesPattern?.trim();
		if (!raw) {
			return "MAT-INS-.YYYY.-";
		}
		return raw;
	}

	private resolveInstallationNoteSeriesPrefix(
		seriesPattern: string,
		date: Date,
	): string {
		const year = String(date.getFullYear());
		let prefix = seriesPattern
			.replace(/\.YYYY\./g, year)
			.replace(/YYYY/g, year)
			.replace(/\./g, "")
			.replace(/--+/g, "-")
			.trim();

		if (!prefix.endsWith("-")) {
			prefix = `${prefix}-`;
		}

		return prefix;
	}

	private async generateInstallationNoteSeries(
		date: Date,
		seriesPattern?: string | null,
		client: Prisma.TransactionClient | PrismaService = this.prisma,
	): Promise<string> {
		const normalizedPattern =
			this.normalizeInstallationNoteSeriesPattern(seriesPattern);
		const prefix = this.resolveInstallationNoteSeriesPrefix(
			normalizedPattern,
			date,
		);

		const existingCounter = await client.documentSeriesCounter.findUnique({
			where: { key: prefix },
			select: { value: true },
		});

		if (existingCounter) {
			return allocateDocumentSeries(client, prefix);
		}

		const lastNote = await client.installationNote.findFirst({
			where: {
				series: { startsWith: prefix },
			},
			orderBy: { series: "desc" },
			select: { series: true },
		});

		return allocateDocumentSeries(
			client,
			prefix,
			5,
			getSeriesSeedValue(prefix, lastNote?.series),
		);
	}

	private async validateInstallationNoteInput(
		tx: Prisma.TransactionClient,
		input: {
			company: string;
			customer: string;
			deliveryNoteId?: string | null;
			status: Inventory.InstallationNoteStatus;
			items: Array<{
				itemId: string;
				serialNoId?: string | null;
				installedQty: number;
			}>;
		},
	): Promise<{
		deliveryNote: { id: string; series: string } | null;
		serialsById: Map<
			string,
			{
				id: string;
				serialNo: string;
				itemId: string;
				company: string;
				status: Inventory.SerialNoStatus;
				deliveryNoteId: string | null;
				isDisabled: boolean;
			}
		>;
	}> {
		const itemIds = [...new Set(input.items.map((item) => item.itemId))];
		const serialIds = [
			...new Set(
				input.items
					.map((item) => item.serialNoId)
					.filter((value): value is string => Boolean(value)),
			),
		];
		const rawSerialIds = input.items
			.map((item) => item.serialNoId)
			.filter((value): value is string => Boolean(value));

		if (serialIds.length !== rawSerialIds.length) {
			throw new BadRequestException(
				"Each serial number can only appear once on an installation note",
			);
		}

		const [items, serials, deliveryNote] = await Promise.all([
			tx.inventoryItem.findMany({
				where: { id: { in: itemIds } },
				select: {
					id: true,
					code: true,
					name: true,
					hasSerialNo: true,
					disabled: true,
				},
			}),
			serialIds.length === 0
				? Promise.resolve([])
				: tx.serialNo.findMany({
						where: { id: { in: serialIds } },
						select: {
							id: true,
							serialNo: true,
							itemId: true,
							company: true,
							status: true,
							deliveryNoteId: true,
							isDisabled: true,
						},
					}),
			input.deliveryNoteId
				? tx.deliveryNote.findUnique({
						where: { id: input.deliveryNoteId },
						select: {
							id: true,
							series: true,
							customer: true,
							company: true,
						},
					})
				: Promise.resolve(null),
		]);

		const itemsById = new Map(items.map((item) => [item.id, item]));
		const serialsById = new Map(
			serials.map((serial) => [
				serial.id,
				{
					...serial,
					status: serial.status as Inventory.SerialNoStatus,
				},
			]),
		);

		if (itemsById.size !== itemIds.length) {
			const missingItemId = itemIds.find((itemId) => !itemsById.has(itemId));
			throw new BadRequestException(
				`Item with ID ${missingItemId ?? "unknown"} was not found`,
			);
		}

		if (serialsById.size !== serialIds.length) {
			const missingSerialId = serialIds.find(
				(serialId) => !serialsById.has(serialId),
			);
			throw new BadRequestException(
				`Serial number with ID ${missingSerialId ?? "unknown"} was not found`,
			);
		}

		if (input.deliveryNoteId && !deliveryNote) {
			throw new BadRequestException(
				`Delivery note with ID ${input.deliveryNoteId} was not found`,
			);
		}

		if (
			deliveryNote &&
			(deliveryNote.company !== input.company ||
				deliveryNote.customer !== input.customer)
		) {
			throw new BadRequestException(
				"Delivery note company and customer must match the installation note",
			);
		}

		for (const row of input.items) {
			const item = itemsById.get(row.itemId);
			if (!item) {
				continue;
			}

			if (item.disabled) {
				throw new BadRequestException(
					`Item ${item.code} is disabled and cannot be installed`,
				);
			}

			if (item.hasSerialNo) {
				if (!row.serialNoId) {
					throw new BadRequestException(
						`Item ${item.code} requires a serial number`,
					);
				}
				if (row.installedQty !== 1) {
					throw new BadRequestException(
						`Serialized item ${item.code} must have an installed quantity of 1`,
					);
				}
			}

			if (!row.serialNoId) {
				continue;
			}

			const serial = serialsById.get(row.serialNoId);
			if (!serial) {
				continue;
			}

			if (serial.isDisabled) {
				throw new BadRequestException(
					`Serial number ${serial.serialNo} is disabled and cannot be installed`,
				);
			}

			if (serial.itemId !== row.itemId) {
				throw new BadRequestException(
					`Serial number ${serial.serialNo} does not belong to item ${item.code}`,
				);
			}

			if (serial.company !== input.company) {
				throw new BadRequestException(
					`Serial number ${serial.serialNo} belongs to a different company`,
				);
			}

			if (
				input.deliveryNoteId &&
				serial.deliveryNoteId !== input.deliveryNoteId
			) {
				throw new BadRequestException(
					`Serial number ${serial.serialNo} is not linked to the selected delivery note`,
				);
			}

			if (input.status === "COMPLETED") {
				if (serial.status === "INSTALLED") {
					throw new BadRequestException(
						`Serial number ${serial.serialNo} is already installed`,
					);
				}
				assertSerialNoStatusTransition(serial.status, "INSTALLED");
			}
		}

		return {
			deliveryNote: deliveryNote
				? { id: deliveryNote.id, series: deliveryNote.series }
				: null,
			serialsById,
		};
	}

	private async applyInstallationNoteSerialUpdates(
		tx: Prisma.TransactionClient,
		input: {
			series: string;
			remarks?: string | null;
			rows: Array<{ serialNoId?: string | null }>;
			serialsById: Map<
				string,
				{
					id: string;
					status: Inventory.SerialNoStatus;
				}
			>;
		},
	): Promise<void> {
		for (const row of input.rows) {
			if (!row.serialNoId) {
				continue;
			}

			const serial = input.serialsById.get(row.serialNoId);
			if (!serial) {
				continue;
			}

			await tx.serialNo.update({
				where: { id: row.serialNoId },
				data: {
					status: "INSTALLED",
					history: {
						create: {
							eventType: "STATUS_CHANGED",
							fromStatus: serial.status,
							toStatus: "INSTALLED",
							warehouseId: null,
							transactionLabel: buildSerialNoTransactionLabel({
								installationNoteSeries: input.series,
							}),
							notes: normalizeOptionalText(input.remarks) ?? null,
						},
					},
				},
			});
		}
	}

	async findInstallationNotes(
		params?: Inventory.ListInstallationNotesInput,
	): Promise<Inventory.InstallationNoteListResult> {
		const rawSkip = params?.skip ?? 0;
		const rawTake = params?.take ?? LIST_QUERY_TAKE_MAX;
		const search = params?.search?.trim();
		const company = params?.company?.trim();
		const sortDirection = params?.sortDirection ?? "desc";

		const skip = rawSkip < 0 ? 0 : rawSkip;
		const take =
			rawTake <= 0
				? 1
				: rawTake > LIST_QUERY_TAKE_MAX
					? LIST_QUERY_TAKE_MAX
					: rawTake;

		const whereClauses: Prisma.InstallationNoteWhereInput[] = [];

		if (search) {
			whereClauses.push({
				OR: [
					{ series: { contains: search, mode: "insensitive" } },
					{ customer: { contains: search, mode: "insensitive" } },
					{ customerName: { contains: search, mode: "insensitive" } },
					{ remarks: { contains: search, mode: "insensitive" } },
					{
						items: {
							some: {
								item: {
									is: { code: { contains: search, mode: "insensitive" } },
								},
							},
						},
					},
					{
						items: {
							some: {
								serialNo: {
									is: {
										serialNo: { contains: search, mode: "insensitive" },
									},
								},
							},
						},
					},
				],
			});
		}

		if (params?.status) {
			whereClauses.push({ status: params.status });
		}

		if (company) {
			whereClauses.push({
				company: { contains: company, mode: "insensitive" },
			});
		}

		if (params?.deliveryNoteId) {
			whereClauses.push({ deliveryNoteId: params.deliveryNoteId });
		}

		const where =
			whereClauses.length === 0
				? undefined
				: whereClauses.length === 1
					? whereClauses[0]
					: { AND: whereClauses };

		const [items, totalCount] = await this.prisma.$transaction([
			this.prisma.installationNote.findMany({
				where,
				include: installationNoteInclude,
				orderBy: this.getInstallationNoteOrderBy(params?.sortBy, sortDirection),
				skip,
				take,
			}),
			this.prisma.installationNote.count({ where }),
		]);

		return {
			items: items.map(toInventoryInstallationNote),
			totalCount,
		};
	}

	async findInstallationNoteById(
		id: string,
	): Promise<Inventory.InstallationNote | null> {
		const note = await this.prisma.installationNote.findUnique({
			where: { id },
			include: installationNoteInclude,
		});

		return note ? toInventoryInstallationNote(note) : null;
	}

	async createInstallationNote(
		data: Inventory.CreateInstallationNoteInput,
	): Promise<Inventory.InstallationNote> {
		const installationDate = data.installationDate ?? new Date();
		const seriesPattern = this.normalizeInstallationNoteSeriesPattern(
			data.seriesPattern,
		);
		const status = data.status ?? "DRAFT";

		const created = await this.prisma.$transaction(async (tx) => {
			if (status === "COMPLETED") {
				await this.lockSerialNoRows(
					tx,
					data.items.map((item) => item.serialNoId),
				);
			}

			const series = await this.generateInstallationNoteSeries(
				installationDate,
				seriesPattern,
				tx,
			);
			const validated = await this.validateInstallationNoteInput(tx, {
				company: data.company,
				customer: data.customer,
				deliveryNoteId: data.deliveryNoteId ?? null,
				status,
				items: data.items,
			});

			const createdNote = await tx.installationNote.create({
				data: {
					series,
					seriesPattern,
					installationDate,
					installationTime: data.installationTime
						? normalizePostingTime(data.installationTime, installationDate)
						: null,
					customer: data.customer,
					customerName: normalizeOptionalText(data.customerName),
					customerAddress: normalizeOptionalText(data.customerAddress),
					contactPerson: normalizeOptionalText(data.contactPerson),
					territory: data.territory?.trim() || "All Territories",
					customerGroup: normalizeOptionalText(data.customerGroup),
					company: data.company,
					status,
					deliveryNoteId: data.deliveryNoteId ?? null,
					remarks: normalizeOptionalText(data.remarks),
					items: {
						create: data.items.map((item) => ({
							itemId: item.itemId,
							serialNoId: item.serialNoId ?? null,
							description: normalizeOptionalText(item.description),
							installedQty: item.installedQty,
						})),
					},
				},
				include: installationNoteInclude,
			});

			if (status === "COMPLETED") {
				await this.applyInstallationNoteSerialUpdates(tx, {
					series,
					remarks: data.remarks,
					rows: data.items,
					serialsById: validated.serialsById,
				});
			}

			return createdNote;
		});

		return toInventoryInstallationNote(created);
	}

	async updateInstallationNote(
		data: Inventory.UpdateInstallationNoteInput,
	): Promise<Inventory.InstallationNote> {
		const updated = await this.prisma.$transaction(async (tx) => {
			await this.lockInstallationNoteRow(tx, data.id);

			const existing = await tx.installationNote.findUnique({
				where: { id: data.id },
				include: {
					items: true,
				},
			});

			if (!existing) {
				throw new NotFoundException(
					`Installation note with ID ${data.id} not found`,
				);
			}

			if (
				existing.status === "COMPLETED" ||
				existing.status === "CANCELLED"
			) {
				throw new BadRequestException(
					"Completed or cancelled installation notes cannot be modified",
				);
			}

			const nextStatus =
				data.status ?? (existing.status as Inventory.InstallationNoteStatus);
			this.assertInstallationNoteStatusTransition(
				existing.status as Inventory.InstallationNoteStatus,
				nextStatus,
			);

			const nextItems =
				data.items ??
				existing.items.map((item) => ({
					id: item.id,
					itemId: item.itemId,
					serialNoId: item.serialNoId,
					description: item.description,
					installedQty: item.installedQty,
				}));

			if (nextStatus === "COMPLETED") {
				await this.lockSerialNoRows(
					tx,
					nextItems.map((item) => item.serialNoId),
				);
			}

			const validated = await this.validateInstallationNoteInput(tx, {
				company: data.company ?? existing.company,
				customer: data.customer ?? existing.customer,
				deliveryNoteId:
					data.deliveryNoteId !== undefined
						? data.deliveryNoteId
						: existing.deliveryNoteId,
				status: nextStatus,
				items: nextItems.map((item) => ({
					itemId: item.itemId,
					serialNoId: item.serialNoId ?? null,
					installedQty: item.installedQty,
				})),
			});

			await tx.installationNote.update({
				where: { id: data.id },
				data: {
					...(data.installationDate !== undefined && {
						installationDate: data.installationDate,
					}),
					...(data.installationTime !== undefined && {
						installationTime: data.installationTime
							? normalizePostingTime(
									data.installationTime,
									data.installationDate ?? existing.installationDate,
								)
							: null,
					}),
					...(data.customer !== undefined && { customer: data.customer }),
					...(data.customerName !== undefined && {
						customerName: normalizeOptionalText(data.customerName),
					}),
					...(data.customerAddress !== undefined && {
						customerAddress: normalizeOptionalText(data.customerAddress),
					}),
					...(data.contactPerson !== undefined && {
						contactPerson: normalizeOptionalText(data.contactPerson),
					}),
					...(data.territory !== undefined && { territory: data.territory }),
					...(data.customerGroup !== undefined && {
						customerGroup: normalizeOptionalText(data.customerGroup),
					}),
					...(data.company !== undefined && { company: data.company }),
					...(data.status !== undefined && { status: data.status }),
					...(data.deliveryNoteId !== undefined && {
						deliveryNoteId: data.deliveryNoteId,
					}),
					...(data.remarks !== undefined && {
						remarks: normalizeOptionalText(data.remarks),
					}),
				},
			});

			if (data.items !== undefined) {
				const keptIds = data.items
					.filter((item): item is typeof item & { id: string } =>
						Boolean(item.id),
					)
					.map((item) => item.id);

				if (keptIds.length > 0) {
					const ownedItems = await tx.installationNoteItem.findMany({
						where: {
							id: { in: keptIds },
							installationNoteId: data.id,
						},
						select: { id: true },
					});
					const ownedIds = new Set(ownedItems.map((item) => item.id));
					const foreignItemId = keptIds.find((itemId) => !ownedIds.has(itemId));
					if (foreignItemId) {
						throw new BadRequestException(
							`Installation note item with ID ${foreignItemId} does not belong to installation note ${data.id}`,
						);
					}
				}

				if (keptIds.length === 0) {
					await tx.installationNoteItem.deleteMany({
						where: { installationNoteId: data.id },
					});
				} else {
					await tx.installationNoteItem.deleteMany({
						where: {
							installationNoteId: data.id,
							id: { notIn: keptIds },
						},
					});
				}

				for (const item of data.items) {
					if (item.id) {
						await tx.installationNoteItem.update({
							where: { id: item.id },
							data: {
								itemId: item.itemId,
								serialNoId: item.serialNoId ?? null,
								description: normalizeOptionalText(item.description),
								installedQty: item.installedQty,
							},
						});
						continue;
					}

					await tx.installationNoteItem.create({
						data: {
							installationNoteId: data.id,
							itemId: item.itemId,
							serialNoId: item.serialNoId ?? null,
							description: normalizeOptionalText(item.description),
							installedQty: item.installedQty,
						},
					});
				}
			}

			if (nextStatus === "COMPLETED") {
				await this.applyInstallationNoteSerialUpdates(tx, {
					series: existing.series,
					remarks: data.remarks !== undefined ? data.remarks : existing.remarks,
					rows: nextItems,
					serialsById: validated.serialsById,
				});
			}

			const note = await tx.installationNote.findUnique({
				where: { id: data.id },
				include: installationNoteInclude,
			});

			if (!note) {
				throw new NotFoundException(
					`Installation note with ID ${data.id} not found`,
				);
			}

			return note;
		});

		return toInventoryInstallationNote(updated);
	}

	async deleteInstallationNote(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		const existing = await this.prisma.installationNote.findUnique({
			where: { id },
			select: {
				id: true,
				status: true,
			},
		});

		if (!existing) {
			throw new NotFoundException(`Installation note with ID ${id} not found`);
		}

		if (existing.status !== "DRAFT") {
			throw new BadRequestException(
				"Only draft installation notes can be deleted",
			);
		}

		await this.prisma.installationNote.delete({
			where: { id },
		});

		return { success: true, id };
	}
}
