import type { Asset } from "@aria/types";

export const DEMO_FINANCE_BOOK_NAME = "Companies Act Book";
export const DEMO_DEPRECIATION_ACCOUNTS = {
	fixedAsset: "Fixed Assets - PTPL",
	accumulatedDepreciation: "Accumulated Depreciation - PTPL",
	depreciationExpense: "Depreciation Expense - PTPL",
	capitalWorkInProgress: "Capital Work in Progress - PTPL",
} as const;

export interface AssetLocationDef {
	name: string;
	isGroup: boolean;
	children?: AssetLocationDef[];
}

export interface AssetCategoryDef {
	name: string;
	depreciationMethod: Asset.DepreciationMethod | null;
	totalNumberOfDepreciations: number | null;
	frequencyOfDepreciation: number | null;
	dailyProrataBased?: boolean;
	shiftBased?: boolean;
	rateOfDepreciation?: number | null;
	expectedValueAfterUsefulLife?: number | null;
	nonDepreciableCategory?: boolean;
	enableCwipAccounting?: boolean;
}

export interface AssetMaintenanceTeamDef {
	key: string;
	name: string;
	maintenanceManager: string;
	maintenanceManagerName: string;
	members: Array<{
		teamMember: string;
		fullName: string;
		maintenanceRole: string;
	}>;
}

export interface AssetActivitySeedDef {
	offsetDays: number;
	activity: string;
}

export interface AssetMaintenanceTaskCompletionDef {
	offsetDays: number;
	actionsPerformed: string;
	hasCertificate?: boolean;
	certificateAttachment?: string | null;
}

export interface AssetMaintenanceTaskSeedDef {
	maintenanceTask: string;
	maintenanceType: Asset.AssetMaintenanceTaskType | null;
	periodicity: Asset.AssetMaintenancePeriodicity;
	startOffsetDays: number;
	endOffsetDays?: number | null;
	certificateRequired?: boolean;
	assignTo: string;
	assignToName: string;
	description?: string | null;
	completions?: AssetMaintenanceTaskCompletionDef[];
}

export interface AssetMaintenancePlanDef {
	teamKey: string;
	tasks: AssetMaintenanceTaskSeedDef[];
}

export interface AssetValueAdjustmentSeedDef {
	kind: "draft" | "submitted" | "cancelled";
	adjustmentOffsetDays: number;
	newAssetValue: number;
	differenceAccount: string;
	costCenter?: string | null;
	notes?: string | null;
	cancelledOffsetDays?: number;
}

export interface AssetSeedDef {
	key: string;
	assetName: string;
	itemCode: string;
	assetCategory: string;
	location: string | null;
	custodian?: string | null;
	department?: string | null;
	purchaseOffsetDays: number;
	availableForUseOffsetDays?: number | null;
	disposalOffsetDays?: number | null;
	netPurchaseAmount: number;
	assetQuantity?: number;
	calculateDepreciation?: boolean;
	openingAccumulatedDepreciation?: number;
	openingNumberOfBookedDepreciations?: number;
	valueAfterDepreciation?: number;
	isFullyDepreciated?: boolean;
	maintenanceRequired?: boolean;
	assetOwner?: Asset.AssetOwner;
	assetOwnerCompany?: string | null;
	supplier?: string | null;
	customer?: string | null;
	policyNumber?: string | null;
	insurer?: string | null;
	insuredValue?: number | null;
	insuranceStartOffsetDays?: number | null;
	insuranceEndOffsetDays?: number | null;
	depreciationMethod?: Asset.DepreciationMethod | null;
	totalNumberOfDepreciations?: number | null;
	frequencyOfDepreciation?: number | null;
	purchaseReceipt?: string | null;
	purchaseInvoice?: string | null;
	status: Asset.AssetStatus;
	activityNotes: AssetActivitySeedDef[];
	maintenancePlan?: AssetMaintenancePlanDef;
	valueAdjustments?: AssetValueAdjustmentSeedDef[];
}

export const ASSET_LOCATIONS: AssetLocationDef[] = [
	{
		name: "All Asset Locations",
		isGroup: true,
		children: [
			{
				name: "Pivotr Bangalore",
				isGroup: true,
				children: [
					{ name: "Peenya Main Warehouse", isGroup: false },
					{ name: "Peenya Production Floor", isGroup: false },
					{ name: "Electronic City Finished Goods", isGroup: false },
					{ name: "Electronic City Integration Lab", isGroup: false },
					{ name: "Whitefield QC Hold Area", isGroup: false },
					{ name: "Whitefield Reliability Lab", isGroup: false },
				],
			},
			{
				name: "Pivotr Chennai",
				isGroup: true,
				children: [
					{ name: "Ambattur Distribution Centre", isGroup: false },
					{ name: "Ambattur Demo & Service Cell", isGroup: false },
				],
			},
			{
				name: "Pivotr Hyderabad",
				isGroup: true,
				children: [
					{ name: "Patancheru Warehouse", isGroup: false },
					{ name: "Patancheru Field Support Desk", isGroup: false },
				],
			},
		],
	},
];

export const ASSET_CATEGORIES: AssetCategoryDef[] = [
	{
		name: "SMT & PCB Assembly Equipment",
		depreciationMethod: "WRITTEN_DOWN_VALUE",
		totalNumberOfDepreciations: 60,
		frequencyOfDepreciation: 1,
		dailyProrataBased: true,
		rateOfDepreciation: 18.1,
	},
	{
		name: "Test & Calibration Instruments",
		depreciationMethod: "STRAIGHT_LINE",
		totalNumberOfDepreciations: 36,
		frequencyOfDepreciation: 3,
		dailyProrataBased: true,
	},
	{
		name: "Warehouse & Material Handling Assets",
		depreciationMethod: "STRAIGHT_LINE",
		totalNumberOfDepreciations: 48,
		frequencyOfDepreciation: 3,
		dailyProrataBased: true,
	},
	{
		name: "IT Infrastructure & End-User Devices",
		depreciationMethod: "STRAIGHT_LINE",
		totalNumberOfDepreciations: 36,
		frequencyOfDepreciation: 1,
		dailyProrataBased: true,
	},
	{
		name: "Utilities & Power Backup Systems",
		depreciationMethod: "WRITTEN_DOWN_VALUE",
		totalNumberOfDepreciations: 72,
		frequencyOfDepreciation: 3,
		dailyProrataBased: true,
		rateOfDepreciation: 15,
	},
	{
		name: "Demo & Field Deployment Systems",
		depreciationMethod: "STRAIGHT_LINE",
		totalNumberOfDepreciations: 24,
		frequencyOfDepreciation: 1,
		dailyProrataBased: true,
	},
];

export const ASSET_MAINTENANCE_TEAMS: AssetMaintenanceTeamDef[] = [
	{
		key: "peenya-plant-maintenance",
		name: "Peenya Plant Maintenance Team",
		maintenanceManager: "PVT-MGR-001",
		maintenanceManagerName: "Amit Kulkarni",
		members: [
			{
				teamMember: "PVT-MNT-001",
				fullName: "Naveen Kumar",
				maintenanceRole: "Senior Maintenance Technician",
			},
			{
				teamMember: "PVT-MNT-002",
				fullName: "Prakash Hegde",
				maintenanceRole: "SMT Line Specialist",
			},
			{
				teamMember: "PVT-MNT-003",
				fullName: "Sunil Patil",
				maintenanceRole: "Process Utilities Technician",
			},
		],
	},
	{
		key: "whitefield-metrology",
		name: "Whitefield Metrology & Reliability Team",
		maintenanceManager: "PVT-MGR-002",
		maintenanceManagerName: "Meghana Rao",
		members: [
			{
				teamMember: "PVT-QA-001",
				fullName: "Arun Prasad",
				maintenanceRole: "Calibration Engineer",
			},
			{
				teamMember: "PVT-QA-002",
				fullName: "Harini Subramanian",
				maintenanceRole: "Reliability Test Engineer",
			},
			{
				teamMember: "PVT-QA-003",
				fullName: "Nitin Joseph",
				maintenanceRole: "Metrology Technician",
			},
		],
	},
	{
		key: "south-operations-support",
		name: "South Operations Support Team",
		maintenanceManager: "PVT-MGR-003",
		maintenanceManagerName: "Sanjay Nair",
		members: [
			{
				teamMember: "PVT-SOUTH-001",
				fullName: "Ritika Menon",
				maintenanceRole: "Field Service Engineer",
			},
			{
				teamMember: "PVT-SOUTH-002",
				fullName: "Karthik Srinivas",
				maintenanceRole: "Demo Deployment Specialist",
			},
			{
				teamMember: "PVT-SOUTH-003",
				fullName: "Farooq Ahmed",
				maintenanceRole: "Regional Warehouse Support Technician",
			},
		],
	},
	{
		key: "facilities-power-systems",
		name: "Facilities & Power Systems Team",
		maintenanceManager: "PVT-MGR-004",
		maintenanceManagerName: "Lakshmi Narayanan",
		members: [
			{
				teamMember: "PVT-FAC-001",
				fullName: "Venkatesh Rao",
				maintenanceRole: "Electrical Maintenance Engineer",
			},
			{
				teamMember: "PVT-FAC-002",
				fullName: "Deepa Shetty",
				maintenanceRole: "Power Systems Technician",
			},
			{
				teamMember: "PVT-FAC-003",
				fullName: "Abdul Rahman",
				maintenanceRole: "Utility Systems Supervisor",
			},
		],
	},
];

export const ASSET_REGISTER: AssetSeedDef[] = [
	{
		key: "peenya-smt-placer-01",
		assetName: "SMT Pick-and-Place Cell 01",
		itemCode: "FA-SMT-PLACER-01",
		assetCategory: "SMT & PCB Assembly Equipment",
		location: "Peenya Production Floor",
		custodian: "Harsha Rao",
		department: "Manufacturing Engineering",
		purchaseOffsetDays: -540,
		availableForUseOffsetDays: -523,
		netPurchaseAmount: 2100000,
		openingAccumulatedDepreciation: 780000,
		openingNumberOfBookedDepreciations: 14,
		valueAfterDepreciation: 1380000,
		maintenanceRequired: true,
		supplier: "Shree Ganesh PCB Solutions",
		policyNumber: "NIA/PE/2024/0412",
		insurer: "New India Assurance Co. Ltd.",
		insuredValue: 2250000,
		insuranceStartOffsetDays: -523,
		insuranceEndOffsetDays: 210,
		purchaseReceipt: "FA-GRN-2024-0012",
		purchaseInvoice: "FA-PINV-2024-0091",
		status: "PARTIALLY_DEPRECIATED",
		activityNotes: [
			{
				offsetDays: -523,
				activity:
					"Commissioned on the Peenya production floor after SAT clearance from Whitefield QC Hold Area.",
			},
			{
				offsetDays: 74,
				activity:
					"Feeder bank retrofit approved for low-volume custom assembly programmes.",
			},
		],
		maintenancePlan: {
			teamKey: "peenya-plant-maintenance",
			tasks: [
				{
					maintenanceTask: "Quarterly feeder calibration",
					maintenanceType: "CALIBRATION",
					periodicity: "QUARTERLY",
					startOffsetDays: -520,
					certificateRequired: true,
					assignTo: "PVT-MNT-002",
					assignToName: "Prakash Hegde",
					description:
						"Calibrate feeder lanes, nozzle offsets, and fiducial alignment before mixed-model production runs.",
					completions: [
						{
							offsetDays: 18,
							actionsPerformed:
								"Feeder lanes 1-20 calibrated and placement repeatability confirmed against golden board.",
							hasCertificate: true,
							certificateAttachment:
								"certificates/asset/peenya-smt-placer-q1-2026.pdf",
						},
						{
							offsetDays: 128,
							actionsPerformed:
								"Nozzle library refreshed and feeder pickup tolerances revalidated after board family changeover.",
							hasCertificate: true,
							certificateAttachment:
								"certificates/asset/peenya-smt-placer-q2-2026.pdf",
						},
						{
							offsetDays: 176,
							actionsPerformed:
								"Annual feeder bank verification completed after retrofit acceptance run.",
							hasCertificate: true,
							certificateAttachment:
								"certificates/asset/peenya-smt-placer-q3-2026.pdf",
						},
					],
				},
				{
					maintenanceTask: "Half-yearly placement head preventive maintenance",
					maintenanceType: "PREVENTIVE_MAINTENANCE",
					periodicity: "HALF_YEARLY",
					startOffsetDays: -520,
					assignTo: "PVT-MNT-001",
					assignToName: "Naveen Kumar",
					description:
						"Inspect gantry lubrication, camera focus, vacuum lines, and placement head backlash.",
					completions: [
						{
							offsetDays: 96,
							actionsPerformed:
								"Placement head bearings inspected and vacuum line filters replaced during scheduled shutdown.",
						},
					],
				},
			],
		},
		valueAdjustments: [
			{
				kind: "submitted",
				adjustmentOffsetDays: 78,
				newAssetValue: 1380000,
				differenceAccount: "Capital Reserve - Asset Upgrades",
				costCenter: "Peenya Manufacturing",
				notes:
					"Capitalized feeder bank and vision alignment retrofit for mixed-volume assembly programmes.",
			},
		],
	},
	{
		key: "peenya-reflow-oven-02",
		assetName: "Lead-Free Reflow Oven Line 02",
		itemCode: "FA-REFLOW-OVEN-02",
		assetCategory: "SMT & PCB Assembly Equipment",
		location: "Peenya Production Floor",
		custodian: "Harsha Rao",
		department: "Manufacturing Engineering",
		purchaseOffsetDays: -480,
		availableForUseOffsetDays: -462,
		netPurchaseAmount: 860000,
		openingAccumulatedDepreciation: 310000,
		openingNumberOfBookedDepreciations: 10,
		valueAfterDepreciation: 550000,
		maintenanceRequired: true,
		supplier: "Balaji Power Systems",
		policyNumber: "ICL/PE/2024/0884",
		insurer: "ICICI Lombard General Insurance",
		insuredValue: 920000,
		insuranceStartOffsetDays: -462,
		insuranceEndOffsetDays: 208,
		purchaseReceipt: "FA-GRN-2024-0021",
		purchaseInvoice: "FA-PINV-2024-0144",
		status: "IN_MAINTENANCE",
		activityNotes: [
			{
				offsetDays: -455,
				activity:
					"Commissioned on Line 02 for lead-free profile work supporting IoT module assemblies.",
			},
			{
				offsetDays: 172,
				activity:
					"Shifted out of line service for heater zone recalibration and conveyor chain replacement.",
			},
			{
				offsetDays: 177,
				activity:
					"Production routed temporarily through the backup oven in Peenya while maintenance remained open.",
			},
		],
		maintenancePlan: {
			teamKey: "peenya-plant-maintenance",
			tasks: [
				{
					maintenanceTask: "Monthly thermal profile verification",
					maintenanceType: "CALIBRATION",
					periodicity: "MONTHLY",
					startOffsetDays: -450,
					certificateRequired: true,
					assignTo: "PVT-MNT-001",
					assignToName: "Naveen Kumar",
					description:
						"Verify lead-free thermal profile across all zones against the standard process recipe.",
					completions: [
						{
							offsetDays: 30,
							actionsPerformed:
								"Zone profile matched standard SAC305 recipe after thermocouple recalibration.",
							hasCertificate: true,
							certificateAttachment:
								"certificates/asset/reflow-oven-profile-jan-2026.pdf",
						},
						{
							offsetDays: 60,
							actionsPerformed:
								"Conveyor speed drift corrected and soak-zone temperatures rebalanced.",
							hasCertificate: true,
							certificateAttachment:
								"certificates/asset/reflow-oven-profile-feb-2026.pdf",
						},
						{
							offsetDays: 90,
							actionsPerformed:
								"March verification completed before telecom board pilot run.",
							hasCertificate: true,
							certificateAttachment:
								"certificates/asset/reflow-oven-profile-mar-2026.pdf",
						},
						{
							offsetDays: 120,
							actionsPerformed:
								"April verification completed after exhaust manifold cleaning.",
							hasCertificate: true,
							certificateAttachment:
								"certificates/asset/reflow-oven-profile-apr-2026.pdf",
						},
						{
							offsetDays: 150,
							actionsPerformed:
								"May production window pre-check signed off ahead of higher-volume gateway controller lots.",
							hasCertificate: true,
							certificateAttachment:
								"certificates/asset/reflow-oven-profile-may-2026.pdf",
						},
					],
				},
				{
					maintenanceTask: "Half-yearly heater and conveyor overhaul",
					maintenanceType: "PREVENTIVE_MAINTENANCE",
					periodicity: "HALF_YEARLY",
					startOffsetDays: -450,
					assignTo: "PVT-MNT-003",
					assignToName: "Sunil Patil",
					description:
						"Inspect heater elements, chain tension, lubrication points, and nitrogen curtain sealing.",
					completions: [
						{
							offsetDays: 20,
							actionsPerformed:
								"Heater bank current draw normalized and conveyor chain guides replaced.",
						},
					],
				},
			],
		},
	},
	{
		key: "whitefield-flying-probe-01",
		assetName: "Flying Probe PCB Tester 01",
		itemCode: "FA-FLYING-PROBE-01",
		assetCategory: "Test & Calibration Instruments",
		location: "Whitefield QC Hold Area",
		custodian: "Priyanka Narayan",
		department: "Quality Assurance",
		purchaseOffsetDays: -420,
		availableForUseOffsetDays: -405,
		netPurchaseAmount: 1450000,
		openingAccumulatedDepreciation: 420000,
		openingNumberOfBookedDepreciations: 8,
		valueAfterDepreciation: 980000,
		maintenanceRequired: true,
		supplier: "Prerna Sensor Technologies",
		policyNumber: "HDF/QA/2024/0209",
		insurer: "HDFC ERGO General Insurance",
		insuredValue: 1525000,
		insuranceStartOffsetDays: -405,
		insuranceEndOffsetDays: 225,
		purchaseReceipt: "FA-GRN-2024-0028",
		purchaseInvoice: "FA-PINV-2024-0178",
		status: "PARTIALLY_DEPRECIATED",
		activityNotes: [
			{
				offsetDays: -390,
				activity:
					"Moved into the Whitefield failure-analysis cell for final test release of multilayer PCB lots.",
			},
			{
				offsetDays: 144,
				activity:
					"Probe card wear exceeded tolerance during accuracy checks and a carrying-value review was initiated.",
			},
		],
		maintenancePlan: {
			teamKey: "whitefield-metrology",
			tasks: [
				{
					maintenanceTask: "Quarterly measurement calibration",
					maintenanceType: "CALIBRATION",
					periodicity: "QUARTERLY",
					startOffsetDays: -390,
					certificateRequired: true,
					assignTo: "PVT-QA-001",
					assignToName: "Arun Prasad",
					description:
						"Verify needle resistance, measurement repeatability, and board fixture compensation values.",
					completions: [
						{
							offsetDays: 40,
							actionsPerformed:
								"Fixture reference board and continuity tolerance set refreshed after telecom backplane programme kickoff.",
							hasCertificate: true,
							certificateAttachment:
								"certificates/asset/flying-probe-q1-2026.pdf",
						},
						{
							offsetDays: 124,
							actionsPerformed:
								"Needle resistance baseline rebuilt and fixture compensation adjusted for denser controller boards.",
							hasCertificate: true,
							certificateAttachment:
								"certificates/asset/flying-probe-q2-2026.pdf",
						},
						{
							offsetDays: 170,
							actionsPerformed:
								"Calibration completed after probe-card refurbishment and Golden Board validation.",
							hasCertificate: true,
							certificateAttachment:
								"certificates/asset/flying-probe-q3-2026.pdf",
						},
					],
				},
			],
		},
		valueAdjustments: [
			{
				kind: "submitted",
				adjustmentOffsetDays: 148,
				newAssetValue: 980000,
				differenceAccount: "Asset Impairment Reserve",
				costCenter: "Whitefield Quality",
				notes:
					"Reduced carrying value after probe-card replacement and slower utilisation against the revised inspection mix.",
			},
		],
	},
	{
		key: "whitefield-env-chamber-01",
		assetName: "Environmental Chamber WH-RLAB-01",
		itemCode: "FA-ENV-CHAMBER-01",
		assetCategory: "Test & Calibration Instruments",
		location: "Whitefield Reliability Lab",
		custodian: "Priyanka Narayan",
		department: "Quality Assurance",
		purchaseOffsetDays: -300,
		availableForUseOffsetDays: -288,
		netPurchaseAmount: 920000,
		openingAccumulatedDepreciation: 180000,
		openingNumberOfBookedDepreciations: 6,
		valueAfterDepreciation: 640000,
		maintenanceRequired: true,
		supplier: "Balaji Power Systems",
		policyNumber: "BAJ/QA/2025/0066",
		insurer: "Bajaj Allianz General Insurance",
		insuredValue: 990000,
		insuranceStartOffsetDays: -288,
		insuranceEndOffsetDays: 210,
		purchaseReceipt: "FA-GRN-2025-0006",
		purchaseInvoice: "FA-PINV-2025-0039",
		status: "OUT_OF_ORDER",
		activityNotes: [
			{
				offsetDays: -280,
				activity:
					"Released for thermal cycling and humidity stress validation after chamber mapping acceptance.",
			},
			{
				offsetDays: 158,
				activity:
					"Temperature stability drift exceeded validation limits during humidity mapping.",
			},
			{
				offsetDays: 160,
				activity:
					"Marked out of order pending compressor and controller replacement approval.",
			},
		],
		maintenancePlan: {
			teamKey: "whitefield-metrology",
			tasks: [
				{
					maintenanceTask: "Monthly chamber mapping verification",
					maintenanceType: "CALIBRATION",
					periodicity: "MONTHLY",
					startOffsetDays: -280,
					certificateRequired: true,
					assignTo: "PVT-QA-002",
					assignToName: "Harini Subramanian",
					description:
						"Verify temperature and humidity uniformity across the working envelope.",
					completions: [
						{
							offsetDays: 25,
							actionsPerformed:
								"Mapping completed with all twelve validation points inside temperature tolerance.",
							hasCertificate: true,
							certificateAttachment:
								"certificates/asset/env-chamber-map-jan-2026.pdf",
						},
						{
							offsetDays: 58,
							actionsPerformed:
								"Humidity uniformity corrected after desiccant cartridge replacement.",
							hasCertificate: true,
							certificateAttachment:
								"certificates/asset/env-chamber-map-feb-2026.pdf",
						},
						{
							offsetDays: 92,
							actionsPerformed:
								"Controller output recalibrated before the March telecom enclosure programme.",
							hasCertificate: true,
							certificateAttachment:
								"certificates/asset/env-chamber-map-mar-2026.pdf",
						},
						{
							offsetDays: 123,
							actionsPerformed:
								"April mapping completed with note on slower pull-down response under high-humidity profile.",
							hasCertificate: true,
							certificateAttachment:
								"certificates/asset/env-chamber-map-apr-2026.pdf",
						},
					],
				},
				{
					maintenanceTask: "Annual compressor and refrigerant service",
					maintenanceType: "PREVENTIVE_MAINTENANCE",
					periodicity: "YEARLY",
					startOffsetDays: -280,
					assignTo: "PVT-QA-003",
					assignToName: "Nitin Joseph",
					description:
						"Inspect compressor current draw, refrigerant pressure, and controller health.",
				},
			],
		},
		valueAdjustments: [
			{
				kind: "submitted",
				adjustmentOffsetDays: 165,
				newAssetValue: 640000,
				differenceAccount: "Asset Impairment Reserve",
				costCenter: "Whitefield Quality",
				notes:
					"Reduced carrying value while the chamber remains out of order awaiting compressor replacement.",
			},
		],
	},
	{
		key: "whitefield-reference-multimeter-01",
		assetName: "Reference Multimeter Calibration Bench",
		itemCode: "FA-REF-MULTI-01",
		assetCategory: "Test & Calibration Instruments",
		location: "Whitefield Reliability Lab",
		custodian: "Priyanka Narayan",
		department: "Quality Assurance",
		purchaseOffsetDays: -360,
		availableForUseOffsetDays: -340,
		netPurchaseAmount: 285000,
		openingAccumulatedDepreciation: 95000,
		openingNumberOfBookedDepreciations: 4,
		valueAfterDepreciation: 190000,
		maintenanceRequired: true,
		supplier: "Aarav Micro Devices",
		policyNumber: "NIA/QA/2024/0731",
		insurer: "New India Assurance Co. Ltd.",
		insuredValue: 310000,
		insuranceStartOffsetDays: -340,
		insuranceEndOffsetDays: 210,
		purchaseReceipt: "FA-GRN-2024-0031",
		purchaseInvoice: "FA-PINV-2024-0203",
		status: "SUBMITTED",
		activityNotes: [
			{
				offsetDays: -330,
				activity:
					"Added to the Whitefield reference instrument pool for final calibration sign-off.",
			},
		],
		maintenancePlan: {
			teamKey: "whitefield-metrology",
			tasks: [
				{
					maintenanceTask: "Half-yearly ISO 17025 traceable calibration",
					maintenanceType: "CALIBRATION",
					periodicity: "HALF_YEARLY",
					startOffsetDays: -330,
					certificateRequired: true,
					assignTo: "PVT-QA-001",
					assignToName: "Arun Prasad",
					description:
						"Validate bench meter accuracy against the traceable laboratory reference chain.",
					completions: [
						{
							offsetDays: 168,
							actionsPerformed:
								"Traceable calibration completed and uncertainty report filed in the QA archive.",
							hasCertificate: true,
							certificateAttachment:
								"certificates/asset/reference-multimeter-apr-2026.pdf",
						},
					],
				},
			],
		},
	},
	{
		key: "ecity-demo-lora-rig-01",
		assetName: "South Cluster LoRa Gateway Demo Rig",
		itemCode: "KIT-LORA-GW",
		assetCategory: "Demo & Field Deployment Systems",
		location: null,
		custodian: "Ritika Menon",
		department: "Field Solutions",
		purchaseOffsetDays: 42,
		availableForUseOffsetDays: 48,
		disposalOffsetDays: 164,
		netPurchaseAmount: 240000,
		openingAccumulatedDepreciation: 15000,
		openingNumberOfBookedDepreciations: 1,
		valueAfterDepreciation: 225000,
		assetOwner: "CUSTOMER",
		supplier: "Vindhya Components Pvt Ltd",
		customer: "Atria IoT Solutions, Koramangala",
		purchaseReceipt: "FA-GRN-2025-0017",
		purchaseInvoice: "FA-PINV-2025-0105",
		status: "SOLD",
		activityNotes: [
			{
				offsetDays: 70,
				activity:
					"Issued to the South Operations Support Team for the Koramangala pilot rollout.",
			},
			{
				offsetDays: 110,
				activity:
					"Returned to the Electronic City integration bench after customer pilot sign-off.",
			},
			{
				offsetDays: 164,
				activity:
					"Sold to Atria IoT Solutions, Koramangala after commercial conversion of the pilot deployment.",
			},
		],
	},
	{
		key: "ambattur-scanner-fleet-01",
		assetName: "Ambattur Handheld Scanner Fleet",
		itemCode: "FA-HHT-SCANNER-01",
		assetCategory: "Warehouse & Material Handling Assets",
		location: "Ambattur Distribution Centre",
		custodian: "Sandeep Reddy",
		department: "Warehouse Operations",
		purchaseOffsetDays: -760,
		availableForUseOffsetDays: -748,
		disposalOffsetDays: 102,
		netPurchaseAmount: 185000,
		assetQuantity: 6,
		openingAccumulatedDepreciation: 160000,
		openingNumberOfBookedDepreciations: 12,
		valueAfterDepreciation: 25000,
		supplier: "Deesha Connectors India",
		purchaseReceipt: "FA-GRN-2023-0007",
		purchaseInvoice: "FA-PINV-2023-0052",
		status: "SCRAPPED",
		activityNotes: [
			{
				offsetDays: 88,
				activity:
					"Battery cycle life and scan-engine failures triggered a replacement review for the Ambattur scanner fleet.",
			},
			{
				offsetDays: 102,
				activity:
					"Scrapped after repeated scan-head failures and uneconomical repair assessment.",
			},
		],
	},
	{
		key: "ecity-workstation-03",
		assetName: "Engineering Workstation ELAB-03",
		itemCode: "FA-ENG-WS-03",
		assetCategory: "IT Infrastructure & End-User Devices",
		location: "Electronic City Integration Lab",
		custodian: "Akash Prabhu",
		department: "IT Infrastructure",
		purchaseOffsetDays: -900,
		availableForUseOffsetDays: -892,
		netPurchaseAmount: 165000,
		openingAccumulatedDepreciation: 165000,
		openingNumberOfBookedDepreciations: 36,
		valueAfterDepreciation: 0,
		isFullyDepreciated: true,
		supplier: "Vindhya Components Pvt Ltd",
		purchaseReceipt: "FA-GRN-2023-0016",
		purchaseInvoice: "FA-PINV-2023-0104",
		status: "FULLY_DEPRECIATED",
		activityNotes: [
			{
				offsetDays: 150,
				activity:
					"Retained in the embedded lab as a fallback engineering station after full depreciation.",
			},
		],
	},
	{
		key: "ecity-edge-server-01",
		assetName: "Edge Telemetry Rack Server 01",
		itemCode: "FA-EDGE-SERVER-01",
		assetCategory: "IT Infrastructure & End-User Devices",
		location: "Electronic City Integration Lab",
		custodian: "Akash Prabhu",
		department: "IT Infrastructure",
		purchaseOffsetDays: -120,
		availableForUseOffsetDays: -110,
		netPurchaseAmount: 480000,
		openingAccumulatedDepreciation: 80000,
		openingNumberOfBookedDepreciations: 6,
		valueAfterDepreciation: 450000,
		supplier: "Aarav Micro Devices",
		policyNumber: "ICL/IT/2025/0182",
		insurer: "ICICI Lombard General Insurance",
		insuredValue: 525000,
		insuranceStartOffsetDays: -110,
		insuranceEndOffsetDays: 255,
		purchaseReceipt: "FA-GRN-2025-0042",
		purchaseInvoice: "FA-PINV-2025-0225",
		status: "PARTIALLY_DEPRECIATED",
		activityNotes: [
			{
				offsetDays: -108,
				activity:
					"Assigned to the device telemetry simulation rack in the Electronic City integration lab.",
			},
			{
				offsetDays: 20,
				activity:
					"Additional GPU memory and NVMe storage were approved for higher-concurrency edge simulation workloads.",
			},
		],
		valueAdjustments: [
			{
				kind: "submitted",
				adjustmentOffsetDays: 24,
				newAssetValue: 450000,
				differenceAccount: "Technology Refresh Reserve",
				costCenter: "Electronic City Engineering",
				notes:
					"Capitalized NVMe storage and memory expansion for larger edge-simulation workloads.",
			},
			{
				kind: "cancelled",
				adjustmentOffsetDays: 171,
				cancelledOffsetDays: 176,
				newAssetValue: 390000,
				differenceAccount: "Asset Impairment Reserve",
				costCenter: "Electronic City Engineering",
				notes:
					"Proposed impairment was reversed after the failed storage module was replaced under AMC coverage.",
			},
		],
	},
	{
		key: "peenya-ups-160kva-01",
		assetName: "Peenya Plant Online UPS 160kVA",
		itemCode: "FA-UPS-160KVA-01",
		assetCategory: "Utilities & Power Backup Systems",
		location: "Peenya Production Floor",
		custodian: "Lakshmi Narayanan",
		department: "Facilities & Utilities",
		purchaseOffsetDays: -650,
		availableForUseOffsetDays: -636,
		netPurchaseAmount: 760000,
		openingAccumulatedDepreciation: 250000,
		openingNumberOfBookedDepreciations: 9,
		valueAfterDepreciation: 510000,
		maintenanceRequired: true,
		supplier: "Balaji Power Systems",
		policyNumber: "HDF/FAC/2024/0117",
		insurer: "HDFC ERGO General Insurance",
		insuredValue: 820000,
		insuranceStartOffsetDays: -636,
		insuranceEndOffsetDays: 240,
		purchaseReceipt: "FA-GRN-2024-0009",
		purchaseInvoice: "FA-PINV-2024-0065",
		status: "SUBMITTED",
		activityNotes: [
			{
				offsetDays: -615,
				activity:
					"Commissioned as the primary power-backup UPS for the Peenya assembly block.",
			},
			{
				offsetDays: 175,
				activity:
					"Battery bank equalization and load-bank test completed ahead of summer power-demand planning.",
			},
		],
		maintenancePlan: {
			teamKey: "facilities-power-systems",
			tasks: [
				{
					maintenanceTask: "Monthly load-bank inspection",
					maintenanceType: "PREVENTIVE_MAINTENANCE",
					periodicity: "MONTHLY",
					startOffsetDays: -620,
					assignTo: "PVT-FAC-002",
					assignToName: "Deepa Shetty",
					description:
						"Verify charger health, bypass operation, and load transfer stability under controlled load.",
					completions: [
						{
							offsetDays: 45,
							actionsPerformed:
								"Load transfer timing validated and charger output trim adjusted.",
						},
						{
							offsetDays: 78,
							actionsPerformed:
								"Battery string impedance recorded and bypass contactor cleaned.",
						},
						{
							offsetDays: 111,
							actionsPerformed:
								"Ventilation alarms tested and charger ripple logged within tolerance.",
						},
						{
							offsetDays: 147,
							actionsPerformed:
								"Short-duration transfer simulation completed during Sunday plant shutdown.",
						},
						{
							offsetDays: 175,
							actionsPerformed:
								"Battery equalization cycle and summer load-bank inspection signed off.",
						},
					],
				},
				{
					maintenanceTask: "Half-yearly battery health audit",
					maintenanceType: "CALIBRATION",
					periodicity: "HALF_YEARLY",
					startOffsetDays: -620,
					certificateRequired: true,
					assignTo: "PVT-FAC-001",
					assignToName: "Venkatesh Rao",
					description:
						"Record string impedance, verify charger balancing, and archive power quality report.",
					completions: [
						{
							offsetDays: 121,
							actionsPerformed:
								"Battery health audit completed with no weak strings requiring replacement.",
							hasCertificate: true,
							certificateAttachment:
								"certificates/asset/ups-battery-health-apr-2026.pdf",
						},
					],
				},
			],
		},
	},
	{
		key: "peenya-generator-panel-01",
		assetName: "Diesel Generator Control Panel 01",
		itemCode: "FA-DG-CONTROL-01",
		assetCategory: "Utilities & Power Backup Systems",
		location: "Peenya Production Floor",
		custodian: "Lakshmi Narayanan",
		department: "Facilities & Utilities",
		purchaseOffsetDays: -580,
		availableForUseOffsetDays: -575,
		netPurchaseAmount: 430000,
		openingAccumulatedDepreciation: 150000,
		openingNumberOfBookedDepreciations: 8,
		valueAfterDepreciation: 280000,
		maintenanceRequired: true,
		supplier: "Rajesh Electricals, Chickpet",
		purchaseReceipt: "FA-GRN-2024-0014",
		purchaseInvoice: "FA-PINV-2024-0088",
		status: "SUBMITTED",
		activityNotes: [
			{
				offsetDays: -575,
				activity:
					"Auto-start control panel commissioned for Peenya plant backup drills.",
			},
			{
				offsetDays: 130,
				activity:
					"Auto-start control logic retuned after a plant-wide power backup drill.",
			},
		],
		maintenancePlan: {
			teamKey: "facilities-power-systems",
			tasks: [
				{
					maintenanceTask: "Quarterly DG auto-start drill",
					maintenanceType: "PREVENTIVE_MAINTENANCE",
					periodicity: "QUARTERLY",
					startOffsetDays: -560,
					assignTo: "PVT-FAC-003",
					assignToName: "Abdul Rahman",
					description:
						"Verify DG controller auto-start sequence, alarm relay logic, and remote panel feedback.",
					completions: [
						{
							offsetDays: 34,
							actionsPerformed:
								"Controller relay logic verified during scheduled facility drill.",
						},
						{
							offsetDays: 124,
							actionsPerformed:
								"Remote panel feedback corrected after battery isolator replacement.",
						},
					],
				},
			],
		},
	},
	{
		key: "hyd-calibration-trolley-01",
		assetName: "Patancheru Field Calibration Trolley",
		itemCode: "FA-CAL-TROLLEY-01",
		assetCategory: "Demo & Field Deployment Systems",
		location: "Patancheru Field Support Desk",
		custodian: "Ritika Menon",
		department: "Field Solutions",
		purchaseOffsetDays: 105,
		availableForUseOffsetDays: 112,
		netPurchaseAmount: 125000,
		openingAccumulatedDepreciation: 0,
		openingNumberOfBookedDepreciations: 0,
		valueAfterDepreciation: 125000,
		maintenanceRequired: true,
		supplier: "Kiran Soldering Supplies",
		purchaseReceipt: "FA-GRN-2026-0004",
		purchaseInvoice: "FA-PINV-2026-0026",
		status: "SUBMITTED",
		activityNotes: [
			{
				offsetDays: 112,
				activity:
					"Allocated to the Patancheru field support desk for South Telangana and Andhra demo visits.",
			},
		],
		maintenancePlan: {
			teamKey: "south-operations-support",
			tasks: [
				{
					maintenanceTask: "Yearly field kit certification",
					maintenanceType: "CALIBRATION",
					periodicity: "YEARLY",
					startOffsetDays: 112,
					certificateRequired: true,
					assignTo: "PVT-SOUTH-002",
					assignToName: "Karthik Srinivas",
					description:
						"Verify trolley-mounted kit inventory, safe transport fixtures, and field measurement readiness.",
				},
			],
		},
	},
	{
		key: "amb-forklift-01",
		assetName: "Ambattur Forklift 2T",
		itemCode: "FA-FORKLIFT-2T-01",
		assetCategory: "Warehouse & Material Handling Assets",
		location: "Ambattur Distribution Centre",
		custodian: "Sandeep Reddy",
		department: "Warehouse Operations",
		purchaseOffsetDays: -700,
		availableForUseOffsetDays: -688,
		netPurchaseAmount: 640000,
		openingAccumulatedDepreciation: 260000,
		openingNumberOfBookedDepreciations: 9,
		valueAfterDepreciation: 380000,
		maintenanceRequired: true,
		supplier: "Rajesh Electricals, Chickpet",
		purchaseReceipt: "FA-GRN-2024-0003",
		purchaseInvoice: "FA-PINV-2024-0024",
		status: "SUBMITTED",
		activityNotes: [
			{
				offsetDays: 44,
				activity:
					"Transferred from Peenya Main Warehouse to Ambattur Distribution Centre to support higher dispatch volumes.",
			},
		],
		maintenancePlan: {
			teamKey: "south-operations-support",
			tasks: [
				{
					maintenanceTask: "Quarterly forklift safety inspection",
					maintenanceType: "PREVENTIVE_MAINTENANCE",
					periodicity: "QUARTERLY",
					startOffsetDays: -680,
					assignTo: "PVT-SOUTH-003",
					assignToName: "Farooq Ahmed",
					description:
						"Inspect mast lift chain, tyre wear, fork alignment, and safety interlocks.",
					completions: [
						{
							offsetDays: 38,
							actionsPerformed:
								"Fork alignment set and mast chain lubrication completed after Chennai monsoon ingress checks.",
						},
						{
							offsetDays: 128,
							actionsPerformed:
								"Brake response and battery connector health verified before the year-end dispatch cycle.",
						},
					],
				},
				{
					maintenanceTask: "Half-yearly hydraulic service",
					maintenanceType: "PREVENTIVE_MAINTENANCE",
					periodicity: "HALF_YEARLY",
					startOffsetDays: -680,
					assignTo: "PVT-SOUTH-001",
					assignToName: "Ritika Menon",
					description:
						"Inspect hydraulic seals, lift smoothness, and counterweight stability.",
					completions: [
						{
							offsetDays: 156,
							actionsPerformed:
								"Hydraulic hose clamps re-torqued and lift cylinder seal seepage resolved.",
						},
					],
				},
			],
		},
	},
	{
		key: "whitefield-aoi-microscope-01",
		assetName: "AOI Rework Microscope 01",
		itemCode: "FA-AOI-MIC-01",
		assetCategory: "Test & Calibration Instruments",
		location: "Whitefield Reliability Lab",
		custodian: "Priyanka Narayan",
		department: "Quality Assurance",
		purchaseOffsetDays: 63,
		availableForUseOffsetDays: 68,
		netPurchaseAmount: 98000,
		openingAccumulatedDepreciation: 0,
		openingNumberOfBookedDepreciations: 0,
		valueAfterDepreciation: 98000,
		maintenanceRequired: false,
		supplier: "Prerna Sensor Technologies",
		purchaseReceipt: "FA-GRN-2025-0025",
		purchaseInvoice: "FA-PINV-2025-0169",
		status: "SUBMITTED",
		activityNotes: [
			{
				offsetDays: 68,
				activity:
					"Installed at the Whitefield rework bench for solder bridge and trace repair verification.",
			},
			{
				offsetDays: 171,
				activity:
					"Higher-resolution camera head and ring light upgrade proposed for AOI rework verification.",
			},
		],
		valueAdjustments: [
			{
				kind: "draft",
				adjustmentOffsetDays: 178,
				newAssetValue: 112000,
				differenceAccount: "Capital Reserve - Test Bench Retrofit",
				costCenter: "Whitefield Quality",
				notes:
					"Draft increase for camera head and ring light retrofit awaiting capital approval.",
			},
		],
	},
];
