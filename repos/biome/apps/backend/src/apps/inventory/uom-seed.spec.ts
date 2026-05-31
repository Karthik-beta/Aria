import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadUomSeedEntriesFromCsv, parseUomSeedCsv } from "./uom-seed";

describe("uom-seed utility", () => {
	it("parses valid csv and maps enabled/whole-number flags correctly", () => {
		const csv = `"UOM Name","Enabled","Must be Whole Number"
"Nos",1,1
"Liters",1,0
"Legacy",0,1
`;

		const result = parseUomSeedCsv(csv);

		expect(result).toEqual([
			{ name: "Nos", disabled: false, isWholeNumber: true },
			{ name: "Liters", disabled: false, isWholeNumber: false },
			{ name: "Legacy", disabled: true, isWholeNumber: true },
		]);
	});

	it("throws when row shape is malformed", () => {
		const csv = `"UOM Name","Enabled","Must be Whole Number"
"Nos",1
`;

		expect(() => parseUomSeedCsv(csv)).toThrow(
			"Malformed UOM seed row at line 2",
		);
	});

	it("loads entries from a csv file", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "aria-uom-seed-"));
		const csvPath = join(tempDir, "uom.csv");

		try {
			await writeFile(
				csvPath,
				`"UOM Name","Enabled","Must be Whole Number"
"Box",1,1
`,
				"utf-8",
			);

			const result = await loadUomSeedEntriesFromCsv(csvPath);
			expect(result).toEqual([
				{ name: "Box", disabled: false, isWholeNumber: true },
			]);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});
