/**
 * Demo Data — Pivotr Electronics Business Reference Data
 *
 * All master-data constants that define the Pivotr Electronics business
 * story. Every name, code, and relationship was chosen to feel like a
 * real Bangalore-based electronics SME.
 *
 * Categories:
 *  - PCB & Circuit Boards
 *  - Sensors & Transducers
 *  - IoT Modules & Dev Kits
 *  - Connectors & Cables
 *  - Display & Interface
 *  - Power Supplies & Batteries
 *  - Passive Components (Resistors, Capacitors, Inductors)
 *  - Custom Assemblies & Enclosures
 */

// ────────────────────────────────────────────────────────────────────
// Brands
// ────────────────────────────────────────────────────────────────────

export const BRANDS = [
	{ name: "Pivotr", description: "In-house brand for assemblies and kits" },
	{
		name: "BEL Semiconductors",
		description: "Bharat Electronics Limited — sensors and ICs",
	},
	{ name: "Suryatech", description: "Indian power supply manufacturer" },
	{
		name: "Rishab Instruments",
		description: "Precision measurement and passive components",
	},
	{ name: "Sahasra Electronics", description: "PCB fabrication and assembly" },
	{
		name: "Silvan Innovation",
		description: "IoT modules and embedded systems",
	},
	{
		name: "ConnectX India",
		description: "Connectors and interconnect solutions",
	},
	{ name: "Tessolve", description: "Semiconductor test & display modules" },
	{ name: "NexGen Power", description: "Battery packs and power management" },
	{
		name: "Vinayak Enclosures",
		description: "Industrial enclosures and housings",
	},
];

// ────────────────────────────────────────────────────────────────────
// Item Groups (hierarchical)
// ────────────────────────────────────────────────────────────────────

export interface ItemGroupDef {
	name: string;
	isGroup: boolean;
	children?: ItemGroupDef[];
}

export const ITEM_GROUPS: ItemGroupDef[] = [
	{
		name: "All Item Groups",
		isGroup: true,
		children: [
			{
				name: "Electronic Components",
				isGroup: true,
				children: [
					{ name: "PCB & Circuit Boards", isGroup: false },
					{ name: "Sensors & Transducers", isGroup: false },
					{ name: "Passive Components", isGroup: false },
					{ name: "Connectors & Cables", isGroup: false },
					{ name: "Display & Interface Modules", isGroup: false },
				],
			},
			{
				name: "Modules & Kits",
				isGroup: true,
				children: [
					{ name: "IoT Modules", isGroup: false },
					{ name: "Development Kits", isGroup: false },
					{ name: "Custom Assemblies", isGroup: false },
				],
			},
			{
				name: "Power & Energy",
				isGroup: true,
				children: [
					{ name: "Power Supplies", isGroup: false },
					{ name: "Battery Packs", isGroup: false },
				],
			},
			{
				name: "Packaging & Enclosures",
				isGroup: true,
				children: [
					{ name: "Enclosures & Housings", isGroup: false },
					{ name: "Packaging Materials", isGroup: false },
				],
			},
			{
				name: "Raw Materials",
				isGroup: true,
				children: [
					{ name: "Solder & Flux", isGroup: false },
					{ name: "Wires & Cables (Raw)", isGroup: false },
					{ name: "Sheet Metal & Plastics", isGroup: false },
				],
			},
			{
				name: "Services",
				isGroup: true,
				children: [
					{ name: "Assembly Services", isGroup: false },
					{ name: "Testing & Calibration", isGroup: false },
				],
			},
		],
	},
];

// ────────────────────────────────────────────────────────────────────
// Items — detailed product catalogue
// ────────────────────────────────────────────────────────────────────

export interface ItemDef {
	code: string;
	name: string;
	group: string; // leaf ItemGroup name
	brand: string;
	description: string;
	uom: string; // default UOM name from uom.csv
	valuationRate: number; // INR cost per unit
	sellingRate: number; // INR selling price per unit
	hasBatchNo: boolean;
	hasSerialNo: boolean;
	maintainStock: boolean;
	weightPerUnit?: number; // kg
	shelfLifeInDays?: number;
	warrantyPeriodInDays?: number;
	safetyStock?: number;
	leadTimeDays?: number;
}

export const ITEMS: ItemDef[] = [
	// ── PCB & Circuit Boards ──────────────────────────────────────
	{
		code: "PCB-FR4-01",
		name: "FR-4 Single-Layer PCB 100×80mm",
		group: "PCB & Circuit Boards",
		brand: "Sahasra Electronics",
		description:
			"Standard FR-4 single-layer PCB blank, 1.6mm thickness, 100×80mm",
		uom: "No",
		valuationRate: 45,
		sellingRate: 85,
		hasBatchNo: true,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.035,
		safetyStock: 500,
		leadTimeDays: 7,
	},
	{
		code: "PCB-FR4-02",
		name: "FR-4 Double-Layer PCB 100×80mm",
		group: "PCB & Circuit Boards",
		brand: "Sahasra Electronics",
		description:
			"FR-4 double-sided PCB, 1.6mm thickness, HASL finish, 100×80mm",
		uom: "No",
		valuationRate: 78,
		sellingRate: 145,
		hasBatchNo: true,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.04,
		safetyStock: 300,
		leadTimeDays: 10,
	},
	{
		code: "PCB-4LYR-01",
		name: "4-Layer PCB 150×100mm Lead-Free",
		group: "PCB & Circuit Boards",
		brand: "Sahasra Electronics",
		description:
			"4-layer multilayer PCB, ENIG surface finish, 150×100mm, RoHS compliant",
		uom: "No",
		valuationRate: 210,
		sellingRate: 395,
		hasBatchNo: true,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.065,
		safetyStock: 100,
		leadTimeDays: 14,
	},
	{
		code: "PCB-FLEX-01",
		name: "Flexible PCB 50×30mm Polyimide",
		group: "PCB & Circuit Boards",
		brand: "Sahasra Electronics",
		description: "Single-sided flexible polyimide PCB, 50×30mm, 0.1mm thick",
		uom: "No",
		valuationRate: 125,
		sellingRate: 240,
		hasBatchNo: true,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.005,
		safetyStock: 200,
		leadTimeDays: 12,
	},

	// ── Sensors & Transducers ─────────────────────────────────────
	{
		code: "SEN-TEMP-01",
		name: "PT100 RTD Temperature Sensor",
		group: "Sensors & Transducers",
		brand: "BEL Semiconductors",
		description: "Platinum RTD PT100 sensor, -50°C to +500°C, Class A accuracy",
		uom: "No",
		valuationRate: 320,
		sellingRate: 595,
		hasBatchNo: true,
		hasSerialNo: true,
		maintainStock: true,
		weightPerUnit: 0.015,
		warrantyPeriodInDays: 365,
		safetyStock: 50,
		leadTimeDays: 5,
	},
	{
		code: "SEN-TEMP-02",
		name: "K-Type Thermocouple Probe 200mm",
		group: "Sensors & Transducers",
		brand: "Rishab Instruments",
		description:
			"K-type thermocouple, stainless steel probe, 200mm length, -40°C to +1100°C",
		uom: "No",
		valuationRate: 180,
		sellingRate: 340,
		hasBatchNo: true,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.045,
		safetyStock: 80,
		leadTimeDays: 4,
	},
	{
		code: "SEN-PROX-01",
		name: "Inductive Proximity Sensor NPN 8mm",
		group: "Sensors & Transducers",
		brand: "BEL Semiconductors",
		description:
			"Inductive proximity sensor, NPN NO, 8mm sensing distance, M18 barrel",
		uom: "No",
		valuationRate: 410,
		sellingRate: 750,
		hasBatchNo: false,
		hasSerialNo: true,
		maintainStock: true,
		weightPerUnit: 0.06,
		warrantyPeriodInDays: 730,
		safetyStock: 40,
		leadTimeDays: 7,
	},
	{
		code: "SEN-HUMD-01",
		name: "DHT22 Digital Humidity & Temperature Sensor",
		group: "Sensors & Transducers",
		brand: "Silvan Innovation",
		description:
			"Digital humidity and temperature sensor, ±2% RH, ±0.5°C, 3.3–5V",
		uom: "No",
		valuationRate: 95,
		sellingRate: 175,
		hasBatchNo: true,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.003,
		safetyStock: 200,
		leadTimeDays: 3,
	},
	{
		code: "SEN-ACCEL-01",
		name: "ADXL345 3-Axis Accelerometer Module",
		group: "Sensors & Transducers",
		brand: "Silvan Innovation",
		description: "3-axis digital accelerometer, ±16g, I2C/SPI, breakout module",
		uom: "No",
		valuationRate: 145,
		sellingRate: 275,
		hasBatchNo: false,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.008,
		safetyStock: 100,
		leadTimeDays: 5,
	},

	// ── Passive Components ────────────────────────────────────────
	{
		code: "RES-SMD-10K",
		name: "10kΩ SMD Resistor 0603 (5000 pcs reel)",
		group: "Passive Components",
		brand: "Rishab Instruments",
		description: "0603 SMD chip resistor, 10kΩ, 1% tolerance, 0.1W, full reel",
		uom: "No",
		valuationRate: 280,
		sellingRate: 450,
		hasBatchNo: true,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.12,
		safetyStock: 20,
		leadTimeDays: 5,
	},
	{
		code: "CAP-CER-100N",
		name: "100nF Ceramic Capacitor 0805 (4000 pcs reel)",
		group: "Passive Components",
		brand: "Rishab Instruments",
		description: "0805 MLCC, 100nF, 50V, X7R, full reel",
		uom: "No",
		valuationRate: 340,
		sellingRate: 550,
		hasBatchNo: true,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.1,
		safetyStock: 15,
		leadTimeDays: 5,
	},
	{
		code: "CAP-ELEC-470U",
		name: "470μF 25V Electrolytic Capacitor",
		group: "Passive Components",
		brand: "Rishab Instruments",
		description:
			"Aluminium electrolytic capacitor, 470μF, 25V, radial, 10×16mm",
		uom: "No",
		valuationRate: 8,
		sellingRate: 15,
		hasBatchNo: true,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.005,
		shelfLifeInDays: 1825,
		safetyStock: 500,
		leadTimeDays: 4,
	},
	{
		code: "IND-SMD-10U",
		name: "10μH SMD Inductor 1210",
		group: "Passive Components",
		brand: "Rishab Instruments",
		description: "SMD power inductor, 10μH, 2A, 1210 package, shielded",
		uom: "No",
		valuationRate: 12,
		sellingRate: 22,
		hasBatchNo: false,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.002,
		safetyStock: 300,
		leadTimeDays: 5,
	},

	// ── Connectors & Cables ───────────────────────────────────────
	{
		code: "CON-USB-C-01",
		name: "USB Type-C 16-Pin SMD Connector",
		group: "Connectors & Cables",
		brand: "ConnectX India",
		description: "USB-C receptacle, 16-pin, mid-mount, SMD, 10,000 cycle rated",
		uom: "No",
		valuationRate: 18,
		sellingRate: 35,
		hasBatchNo: true,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.003,
		safetyStock: 1000,
		leadTimeDays: 6,
	},
	{
		code: "CON-JST-4P",
		name: "JST-XH 4-Pin Male Header + Housing",
		group: "Connectors & Cables",
		brand: "ConnectX India",
		description:
			"JST-XH 2.54mm 4-pin through-hole header with plug housing, pre-crimped wires",
		uom: "No",
		valuationRate: 5,
		sellingRate: 12,
		hasBatchNo: false,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.002,
		safetyStock: 2000,
		leadTimeDays: 3,
	},
	{
		code: "CON-RJ45-01",
		name: "RJ45 Ethernet Connector with LED",
		group: "Connectors & Cables",
		brand: "ConnectX India",
		description:
			"RJ45 modular jack, shielded, with integrated LED, through-hole",
		uom: "No",
		valuationRate: 22,
		sellingRate: 42,
		hasBatchNo: false,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.008,
		safetyStock: 500,
		leadTimeDays: 5,
	},
	{
		code: "CBL-RIBBON-20",
		name: "20-Pin Flat Ribbon Cable 300mm",
		group: "Connectors & Cables",
		brand: "ConnectX India",
		description:
			"20-pin IDC flat ribbon cable, 1.27mm pitch, 300mm length, grey",
		uom: "No",
		valuationRate: 15,
		sellingRate: 28,
		hasBatchNo: false,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.018,
		safetyStock: 200,
		leadTimeDays: 3,
	},

	// ── Display & Interface Modules ───────────────────────────────
	{
		code: "DIS-OLED-128",
		name: '0.96" OLED Display Module 128×64 I2C',
		group: "Display & Interface Modules",
		brand: "Tessolve",
		description:
			"0.96 inch OLED display, SSD1306 driver, 128×64 pixels, I2C, white",
		uom: "No",
		valuationRate: 165,
		sellingRate: 310,
		hasBatchNo: true,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.01,
		warrantyPeriodInDays: 180,
		safetyStock: 100,
		leadTimeDays: 7,
	},
	{
		code: "DIS-TFT-35",
		name: '3.5" TFT LCD Touch Display SPI',
		group: "Display & Interface Modules",
		brand: "Tessolve",
		description:
			"3.5 inch TFT LCD, 320×480, ILI9488, resistive touch, SPI interface",
		uom: "No",
		valuationRate: 520,
		sellingRate: 950,
		hasBatchNo: false,
		hasSerialNo: true,
		maintainStock: true,
		weightPerUnit: 0.065,
		warrantyPeriodInDays: 365,
		safetyStock: 30,
		leadTimeDays: 10,
	},
	{
		code: "DIS-7SEG-4D",
		name: "4-Digit 7-Segment LED Display Module",
		group: "Display & Interface Modules",
		brand: "Tessolve",
		description: 'TM1637 driver, 4-digit 0.56" red LED, common anode, 5V',
		uom: "No",
		valuationRate: 55,
		sellingRate: 105,
		hasBatchNo: false,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.012,
		safetyStock: 150,
		leadTimeDays: 4,
	},

	// ── IoT Modules ───────────────────────────────────────────────
	{
		code: "IOT-ESP32-01",
		name: "ESP32-WROOM-32E Wi-Fi+BLE Module",
		group: "IoT Modules",
		brand: "Silvan Innovation",
		description:
			"ESP32-WROOM-32E, dual-core 240MHz, 4MB flash, Wi-Fi + BLE 5.0",
		uom: "No",
		valuationRate: 195,
		sellingRate: 365,
		hasBatchNo: true,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.01,
		safetyStock: 200,
		leadTimeDays: 8,
	},
	{
		code: "IOT-LORA-01",
		name: "SX1276 LoRa Transceiver Module 868MHz",
		group: "IoT Modules",
		brand: "Silvan Innovation",
		description: "LoRa spread spectrum, SX1276, 868MHz ISM band, SPI, +20dBm",
		uom: "No",
		valuationRate: 280,
		sellingRate: 520,
		hasBatchNo: true,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.008,
		safetyStock: 80,
		leadTimeDays: 10,
	},
	{
		code: "IOT-4G-01",
		name: "SIM7600E-H 4G LTE Cat-1 Module",
		group: "IoT Modules",
		brand: "Silvan Innovation",
		description: "4G LTE Cat-1 module, voice + data, GNSS, India band support",
		uom: "No",
		valuationRate: 1250,
		sellingRate: 2200,
		hasBatchNo: false,
		hasSerialNo: true,
		maintainStock: true,
		weightPerUnit: 0.018,
		warrantyPeriodInDays: 365,
		safetyStock: 25,
		leadTimeDays: 14,
	},

	// ── Development Kits ──────────────────────────────────────────
	{
		code: "KIT-IOT-STRT",
		name: "Pivotr IoT Starter Kit v3",
		group: "Development Kits",
		brand: "Pivotr",
		description:
			"Complete IoT development kit: ESP32 board, sensors, OLED, breadboard, jumper wires, USB cable, tutorial booklet",
		uom: "No",
		valuationRate: 890,
		sellingRate: 1650,
		hasBatchNo: false,
		hasSerialNo: true,
		maintainStock: true,
		weightPerUnit: 0.35,
		warrantyPeriodInDays: 180,
		safetyStock: 20,
		leadTimeDays: 3,
	},
	{
		code: "KIT-LORA-GW",
		name: "Pivotr LoRa Gateway Kit",
		group: "Development Kits",
		brand: "Pivotr",
		description:
			"LoRa gateway + 3 sensor nodes, outdoor enclosure, 4G backhaul module, PoE adapter, setup guide",
		uom: "No",
		valuationRate: 4800,
		sellingRate: 8500,
		hasBatchNo: false,
		hasSerialNo: true,
		maintainStock: true,
		weightPerUnit: 1.2,
		warrantyPeriodInDays: 365,
		safetyStock: 5,
		leadTimeDays: 7,
	},

	// ── Power Supplies ────────────────────────────────────────────
	{
		code: "PWR-SMPS-12V5A",
		name: "12V 5A SMPS Power Supply",
		group: "Power Supplies",
		brand: "Suryatech",
		description:
			"Enclosed SMPS, 12V DC 5A output, 90–264V AC input, BIS certified",
		uom: "No",
		valuationRate: 280,
		sellingRate: 520,
		hasBatchNo: true,
		hasSerialNo: true,
		maintainStock: true,
		weightPerUnit: 0.22,
		warrantyPeriodInDays: 730,
		safetyStock: 50,
		leadTimeDays: 5,
	},
	{
		code: "PWR-SMPS-5V10A",
		name: "5V 10A SMPS Power Supply",
		group: "Power Supplies",
		brand: "Suryatech",
		description:
			"Enclosed SMPS, 5V DC 10A output, universal AC input, short-circuit protection",
		uom: "No",
		valuationRate: 320,
		sellingRate: 590,
		hasBatchNo: true,
		hasSerialNo: true,
		maintainStock: true,
		weightPerUnit: 0.3,
		warrantyPeriodInDays: 730,
		safetyStock: 40,
		leadTimeDays: 5,
	},
	{
		code: "PWR-ADAPTER-9V",
		name: "9V 2A DC Adapter (Barrel Jack)",
		group: "Power Supplies",
		brand: "Suryatech",
		description:
			"Wall-mount DC adapter, 9V 2A, 5.5×2.1mm barrel, BIS certified, 1.5m cable",
		uom: "No",
		valuationRate: 95,
		sellingRate: 180,
		hasBatchNo: false,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.08,
		safetyStock: 100,
		leadTimeDays: 3,
	},

	// ── Battery Packs ──────────────────────────────────────────────
	{
		code: "BAT-LIPO-3S",
		name: "11.1V 2200mAh LiPo Battery Pack 3S",
		group: "Battery Packs",
		brand: "NexGen Power",
		description:
			"3S1P lithium polymer battery, 11.1V 2200mAh, 25C discharge, XT60 connector",
		uom: "No",
		valuationRate: 580,
		sellingRate: 1050,
		hasBatchNo: true,
		hasSerialNo: true,
		maintainStock: true,
		weightPerUnit: 0.18,
		shelfLifeInDays: 730,
		warrantyPeriodInDays: 365,
		safetyStock: 30,
		leadTimeDays: 7,
	},
	{
		code: "BAT-18650-CELL",
		name: "18650 Li-Ion Cell 3.7V 3400mAh",
		group: "Battery Packs",
		brand: "NexGen Power",
		description:
			"High-capacity 18650 lithium-ion cell, unprotected, flat top, Panasonic NCR18650B grade",
		uom: "No",
		valuationRate: 145,
		sellingRate: 265,
		hasBatchNo: true,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.047,
		shelfLifeInDays: 1095,
		safetyStock: 200,
		leadTimeDays: 10,
	},

	// ── Enclosures & Housings ─────────────────────────────────────
	{
		code: "ENC-ABS-01",
		name: "ABS Project Enclosure 150×100×50mm",
		group: "Enclosures & Housings",
		brand: "Vinayak Enclosures",
		description:
			"ABS plastic enclosure, IP54, grey, with mounting flanges, 150×100×50mm",
		uom: "No",
		valuationRate: 85,
		sellingRate: 160,
		hasBatchNo: false,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.12,
		safetyStock: 100,
		leadTimeDays: 5,
	},
	{
		code: "ENC-DIN-01",
		name: "DIN Rail Enclosure 4-Module",
		group: "Enclosures & Housings",
		brand: "Vinayak Enclosures",
		description:
			"Modular DIN rail housing, 4 module width, polycarbonate, transparent cover",
		uom: "No",
		valuationRate: 120,
		sellingRate: 225,
		hasBatchNo: false,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.09,
		safetyStock: 60,
		leadTimeDays: 5,
	},
	{
		code: "ENC-IP67-01",
		name: "IP67 Weatherproof Enclosure 200×150×75mm",
		group: "Enclosures & Housings",
		brand: "Vinayak Enclosures",
		description:
			"IP67 rated die-cast aluminium enclosure, unpainted, 200×150×75mm",
		uom: "No",
		valuationRate: 350,
		sellingRate: 640,
		hasBatchNo: false,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.55,
		safetyStock: 20,
		leadTimeDays: 8,
	},

	// ── Custom Assemblies ─────────────────────────────────────────
	{
		code: "ASM-CTRL-V2",
		name: "Pivotr Industrial Control Board v2",
		group: "Custom Assemblies",
		brand: "Pivotr",
		description:
			"Custom control PCB assembly: STM32F4 MCU, 4 relay outputs, RS485, CAN, 24V input, conformal coated",
		uom: "No",
		valuationRate: 1850,
		sellingRate: 3400,
		hasBatchNo: true,
		hasSerialNo: true,
		maintainStock: true,
		weightPerUnit: 0.12,
		warrantyPeriodInDays: 365,
		safetyStock: 15,
		leadTimeDays: 14,
	},
	{
		code: "ASM-SENSE-HUB",
		name: "Pivotr Sensor Hub Module",
		group: "Custom Assemblies",
		brand: "Pivotr",
		description:
			"Multi-sensor data aggregation module: 4 analog + 4 digital inputs, ESP32, LoRa, IP54 enclosure",
		uom: "No",
		valuationRate: 2400,
		sellingRate: 4200,
		hasBatchNo: true,
		hasSerialNo: true,
		maintainStock: true,
		weightPerUnit: 0.25,
		warrantyPeriodInDays: 365,
		safetyStock: 10,
		leadTimeDays: 14,
	},

	// ── Raw Materials ─────────────────────────────────────────────
	{
		code: "RAW-SOLDER-01",
		name: "Lead-Free Solder Wire 0.8mm 500g",
		group: "Solder & Flux",
		brand: "Rishab Instruments",
		description:
			"Sn99.3Cu0.7 lead-free solder wire, 0.8mm diameter, rosin-core, 500g spool",
		uom: "No",
		valuationRate: 680,
		sellingRate: 1100,
		hasBatchNo: true,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.5,
		shelfLifeInDays: 1095,
		safetyStock: 10,
		leadTimeDays: 3,
	},
	{
		code: "RAW-FLUX-01",
		name: "No-Clean Flux Pen 10ml",
		group: "Solder & Flux",
		brand: "Rishab Instruments",
		description: "No-clean rosin flux pen, 10ml, for hand soldering and rework",
		uom: "No",
		valuationRate: 120,
		sellingRate: 220,
		hasBatchNo: true,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.015,
		shelfLifeInDays: 548,
		safetyStock: 20,
		leadTimeDays: 3,
	},
	{
		code: "RAW-WIRE-22AWG",
		name: "Silicone Wire 22AWG Red/Black (10m pair)",
		group: "Wires & Cables (Raw)",
		brand: "ConnectX India",
		description:
			"22AWG silicone-insulated stranded wire, red + black pair, 10m each, 200°C rated",
		uom: "No",
		valuationRate: 90,
		sellingRate: 160,
		hasBatchNo: false,
		hasSerialNo: false,
		maintainStock: true,
		weightPerUnit: 0.06,
		safetyStock: 50,
		leadTimeDays: 3,
	},
];

// ── Item Attributes (for variants) ───────────────────────────────

export interface AttributeDef {
	name: string;
	values: { value: string; abbreviation: string }[];
}

export const ITEM_ATTRIBUTES: AttributeDef[] = [
	{
		name: "Colour",
		values: [
			{ value: "Red", abbreviation: "RED" },
			{ value: "Blue", abbreviation: "BLU" },
			{ value: "Green", abbreviation: "GRN" },
			{ value: "Black", abbreviation: "BLK" },
			{ value: "White", abbreviation: "WHT" },
		],
	},
	{
		name: "Voltage Rating",
		values: [
			{ value: "3.3V", abbreviation: "3V3" },
			{ value: "5V", abbreviation: "5V" },
			{ value: "12V", abbreviation: "12V" },
			{ value: "24V", abbreviation: "24V" },
		],
	},
	{
		name: "Operating Temperature",
		values: [
			{ value: "Standard (0–70°C)", abbreviation: "STD" },
			{ value: "Industrial (-40–85°C)", abbreviation: "IND" },
			{ value: "Automotive (-40–125°C)", abbreviation: "AUT" },
		],
	},
	{
		name: "Communication Protocol",
		values: [
			{ value: "I2C", abbreviation: "I2C" },
			{ value: "SPI", abbreviation: "SPI" },
			{ value: "UART", abbreviation: "UAR" },
			{ value: "RS485", abbreviation: "485" },
			{ value: "CAN", abbreviation: "CAN" },
		],
	},
];

// ── Warehouses ────────────────────────────────────────────────────

export interface WarehouseDef {
	name: string;
	isGroup: boolean;
	warehouseType?: string;
	city?: string;
	state?: string;
	pin?: string;
	addressLine1?: string;
	isRejected?: boolean;
	children?: WarehouseDef[];
}

export const WAREHOUSES: WarehouseDef[] = [
	{
		name: "All Warehouses",
		isGroup: true,
		children: [
			{
				name: "Pivotr Bangalore",
				isGroup: true,
				city: "Bengaluru",
				state: "Karnataka",
				children: [
					{
						name: "Peenya Main Warehouse",
						isGroup: false,
						warehouseType: "Warehouse",
						addressLine1: "Plot 14, 3rd Phase, Peenya Industrial Area",
						city: "Bengaluru",
						state: "Karnataka",
						pin: "560058",
					},
					{
						name: "Peenya Raw Material Store",
						isGroup: false,
						warehouseType: "Warehouse",
						addressLine1: "Plot 14-A, 3rd Phase, Peenya Industrial Area",
						city: "Bengaluru",
						state: "Karnataka",
						pin: "560058",
					},
					{
						name: "Electronic City Finished Goods",
						isGroup: false,
						warehouseType: "Warehouse",
						addressLine1: "Unit 7, Elcita SEZ, Electronic City Phase 1",
						city: "Bengaluru",
						state: "Karnataka",
						pin: "560100",
					},
					{
						name: "Whitefield QC Hold Area",
						isGroup: false,
						warehouseType: "Warehouse",
						addressLine1: "Block B, ITPL Road, Whitefield",
						city: "Bengaluru",
						state: "Karnataka",
						pin: "560066",
					},
					{
						name: "Whitefield Rejected Goods",
						isGroup: false,
						warehouseType: "Warehouse",
						addressLine1: "Block B, ITPL Road, Whitefield",
						city: "Bengaluru",
						state: "Karnataka",
						pin: "560066",
						isRejected: true,
					},
					{
						name: "In Transit - Bangalore",
						isGroup: false,
						warehouseType: "Transit",
						city: "Bengaluru",
						state: "Karnataka",
					},
				],
			},
			{
				name: "Pivotr Chennai",
				isGroup: true,
				city: "Chennai",
				state: "Tamil Nadu",
				children: [
					{
						name: "Ambattur Distribution Centre",
						isGroup: false,
						warehouseType: "Warehouse",
						addressLine1: "Plot 42, Industrial Estate, Ambattur",
						city: "Chennai",
						state: "Tamil Nadu",
						pin: "600058",
					},
				],
			},
			{
				name: "Pivotr Hyderabad",
				isGroup: true,
				city: "Hyderabad",
				state: "Telangana",
				children: [
					{
						name: "Patancheru Warehouse",
						isGroup: false,
						warehouseType: "Warehouse",
						addressLine1: "Shed 19, TSIIC Industrial Park, Patancheru",
						city: "Hyderabad",
						state: "Telangana",
						pin: "502319",
					},
				],
			},
		],
	},
];

// ── Suppliers / Vendors ───────────────────────────────────────────

export const SUPPLIERS = [
	"Rajesh Electricals, Chickpet",
	"Vindhya Components Pvt Ltd",
	"Kripa Electronic Systems",
	"Shree Ganesh PCB Solutions",
	"Aarav Micro Devices",
	"Kiran Soldering Supplies",
	"Deesha Connectors India",
	"Balaji Power Systems",
	"Prerna Sensor Technologies",
	"Laxmi Industrial Packaging",
];

// ── Customers ─────────────────────────────────────────────────────

export const CUSTOMERS = [
	"Atria IoT Solutions, Koramangala",
	"Bharat Heavy Electricals Ltd, Mysuru",
	"Centum Electronics, Whitefield",
	"Delphi Systems Pvt Ltd, Pune",
	"Exicom Tele-Systems, Gurugram",
	"Forteq India, Hosur",
	"Gensol Engineering Ltd, Ahmedabad",
	"H-Energy Pvt Ltd, Mumbai",
	"iBot Automation, Peenya",
	"Jio Platforms Ltd, Navi Mumbai",
	"Kaynes Technology, Mysuru",
	"Lava International, Noida",
	"Minda Corporation, Manesar",
	"NCS Computech, Bengaluru",
	"Optiemus Electronics, Greater Noida",
];

// ── Manufacturers ─────────────────────────────────────────────────

export const MANUFACTURERS = [
	{ name: "Texas Instruments India", partPrefix: "TI" },
	{ name: "STMicroelectronics India", partPrefix: "STM" },
	{ name: "Espressif Systems", partPrefix: "ESP" },
	{ name: "Semtech Corporation", partPrefix: "SEM" },
	{ name: "Murata Manufacturing", partPrefix: "MUR" },
	{ name: "TDK Electronics India", partPrefix: "TDK" },
	{ name: "Yageo Corporation", partPrefix: "YAG" },
	{ name: "Molex India", partPrefix: "MOL" },
];

// ── QI Templates ──────────────────────────────────────────────────

export interface QiTemplateDef {
	name: string;
	parameters: {
		name: string;
		group: string;
		numeric: boolean;
		minValue?: number;
		maxValue?: number;
		value?: string;
	}[];
}

export const QI_TEMPLATES: QiTemplateDef[] = [
	{
		name: "PCB Visual Inspection",
		parameters: [
			{
				name: "Solder Joint Quality",
				group: "Visual",
				numeric: false,
				value: "Acceptable",
			},
			{
				name: "Component Placement Accuracy",
				group: "Visual",
				numeric: true,
				minValue: 0,
				maxValue: 0.15,
			},
			{
				name: "Surface Finish Quality",
				group: "Visual",
				numeric: false,
				value: "Pass",
			},
			{
				name: "Trace Width Compliance",
				group: "Dimensional",
				numeric: true,
				minValue: 0.1,
				maxValue: 0.3,
			},
		],
	},
	{
		name: "Sensor Calibration Check",
		parameters: [
			{
				name: "Zero-Point Offset",
				group: "Calibration",
				numeric: true,
				minValue: -0.5,
				maxValue: 0.5,
			},
			{
				name: "Sensitivity Deviation",
				group: "Calibration",
				numeric: true,
				minValue: -2,
				maxValue: 2,
			},
			{
				name: "Response Time (ms)",
				group: "Performance",
				numeric: true,
				minValue: 0,
				maxValue: 50,
			},
			{
				name: "Linearity Error (%FS)",
				group: "Performance",
				numeric: true,
				minValue: 0,
				maxValue: 1,
			},
		],
	},
	{
		name: "Power Supply Load Test",
		parameters: [
			{
				name: "Output Voltage Accuracy",
				group: "Electrical",
				numeric: true,
				minValue: -3,
				maxValue: 3,
			},
			{
				name: "Ripple Voltage (mV)",
				group: "Electrical",
				numeric: true,
				minValue: 0,
				maxValue: 100,
			},
			{
				name: "Efficiency at Full Load (%)",
				group: "Performance",
				numeric: true,
				minValue: 85,
				maxValue: 100,
			},
			{
				name: "Overload Protection",
				group: "Safety",
				numeric: false,
				value: "Pass",
			},
			{
				name: "Short Circuit Protection",
				group: "Safety",
				numeric: false,
				value: "Pass",
			},
		],
	},
	{
		name: "Incoming Component Inspection",
		parameters: [
			{
				name: "Package Condition",
				group: "Visual",
				numeric: false,
				value: "Undamaged",
			},
			{
				name: "Label Accuracy",
				group: "Visual",
				numeric: false,
				value: "Correct",
			},
			{
				name: "Moisture Indicator",
				group: "Environmental",
				numeric: false,
				value: "Dry",
			},
			{
				name: "Sample Electrical Test",
				group: "Electrical",
				numeric: false,
				value: "Pass",
			},
		],
	},
	{
		name: "Enclosure IP Rating Test",
		parameters: [
			{
				name: "Seal Integrity",
				group: "Mechanical",
				numeric: false,
				value: "Pass",
			},
			{
				name: "Ingress Protection (Water)",
				group: "Environmental",
				numeric: false,
				value: "Pass",
			},
			{
				name: "Ingress Protection (Dust)",
				group: "Environmental",
				numeric: false,
				value: "Pass",
			},
			{
				name: "Drop Test (1m)",
				group: "Mechanical",
				numeric: false,
				value: "Pass",
			},
		],
	},
];

// ── Shipping Rules ────────────────────────────────────────────────

export const SHIPPING_RULES = [
	{
		label: "Standard Courier — South India",
		type: "SELLING" as const,
		calcType: "FIXED" as const,
		amount: 150,
	},
	{
		label: "Express Courier — Pan India",
		type: "SELLING" as const,
		calcType: "FIXED" as const,
		amount: 350,
	},
	{
		label: "Bulk Freight — By Weight",
		type: "SELLING" as const,
		calcType: "NET_WEIGHT" as const,
		amount: 25,
	},
	{
		label: "Free Shipping — Orders above ₹10,000",
		type: "SELLING" as const,
		calcType: "NET_TOTAL" as const,
		amount: 0,
	},
	{
		label: "Vendor Pickup — No Charge",
		type: "BUYING" as const,
		calcType: "FIXED" as const,
		amount: 0,
	},
	{
		label: "Vendor Freight — Per Kg",
		type: "BUYING" as const,
		calcType: "NET_WEIGHT" as const,
		amount: 18,
	},
];

// ── Drivers for delivery trips ────────────────────────────────────

export const DRIVERS = [
	{
		name: "Ramesh Kumar",
		address: "No. 12, 2nd Cross, Rajajinagar, Bengaluru",
	},
	{
		name: "Mohammed Irfan",
		address: "Flat 304, Lake View Apts, Ulsoor, Bengaluru",
	},
	{
		name: "Suresh Gowda",
		address: "45/2, Kanakapura Road, JP Nagar, Bengaluru",
	},
];

export const VEHICLES = ["KA-01-AB-1234", "KA-05-MR-7890", "KA-03-JC-4567"];
