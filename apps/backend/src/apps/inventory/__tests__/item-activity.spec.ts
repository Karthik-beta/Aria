import { Inventory } from "@aria/types";
import { ItemActivityService } from "../services/item-activity.service";

// Mock prisma client
const mockCreate = jest.fn();
const mockFindMany = jest.fn();
const mockDeleteMany = jest.fn();

const mockPrisma = {
	itemActivityLog: {
		create: mockCreate,
		findMany: mockFindMany,
		deleteMany: mockDeleteMany,
	},
};

describe("ItemActivityService", () => {
	let service: ItemActivityService;

	beforeEach(() => {
		jest.clearAllMocks();
		service = new ItemActivityService(mockPrisma as any);
	});

	describe("logActivity", () => {
		it("should create an activity log entry", async () => {
			const input: Inventory.CreateItemActivityLogInput = {
				itemId: "item-123",
				activityType: "STOCK_IN",
				description: "Received 100 units via Purchase Receipt",
				quantity: 100,
				company: "Test Company",
			};

			const expected = {
				id: "log-1",
				itemId: input.itemId,
				activityType: input.activityType,
				description: input.description,
				quantity: 100,
				value: null,
				company: "Test Company",
				warehouse: null,
				referenceType: null,
				referenceId: null,
				referenceName: null,
				metadata: null,
				createdAt: new Date(),
			};

			mockCreate.mockResolvedValue(expected);

			const result = await service.logActivity(input);

			expect(result).toEqual(expected);
			expect(mockCreate).toHaveBeenCalledWith({
				data: {
					itemId: input.itemId,
					activityType: input.activityType,
					description: input.description,
					quantity: 100,
					value: null,
					company: "Test Company",
					warehouse: null,
					referenceType: null,
					referenceId: null,
					referenceName: null,
					metadata: undefined,
				},
			});
		});
	});

	describe("getActivityForItem", () => {
		it("should return activity entries for an item", async () => {
			const itemId = "item-123";
			const entries = [
				{
					id: "log-1",
					itemId,
					activityType: "STOCK_IN",
					description: "Received 100 units",
					quantity: 100,
					value: null,
					company: "Test Company",
					warehouse: null,
					referenceType: "PurchaseReceipt",
					referenceId: "pr-1",
					referenceName: "MAT-PRE-2026-00001",
					metadata: null,
					createdAt: new Date(),
				},
			];

			mockFindMany.mockResolvedValue(entries);

			const result = await service.getActivityForItem({ itemId });

			expect(result).toEqual(entries);
			expect(mockFindMany).toHaveBeenCalledWith({
				where: { itemId },
				orderBy: { createdAt: "desc" },
				take: 50,
				skip: 0,
			});
		});
	});
});