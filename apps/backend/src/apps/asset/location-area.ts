/**
 * Location area computation — pure functions, no I/O.
 *
 * Ported from ERPNext `erpnext/assets/doctype/location/location.py`
 * (`compute_area`, `_polygon_area`, `_ring_area`), GPLv3,
 * Copyright (c) 2018, Frappe Technologies Pvt. Ltd. and contributors.
 * ERPNext in turn references https://github.com/scisco/area.
 *
 * Aria deliberately differs from ERPNext in one respect: ERPNext copies child
 * features into every ancestor and mutates the ancestors' `area` on each save.
 * Aria keeps each location's own `area` and rolls descendants up at read time
 * (`Asset.LocationTreeNode.totalArea`, see `location-tree.ts`).
 *
 * @module LocationArea
 */

/** Earth radius in metres used by ERPNext (WGS84 equatorial radius). */
export const EARTH_RADIUS = 6378137;

type Position = readonly number[];

/** Minimal GeoJSON Feature shape needed for area computation. */
export interface AreaFeature {
	type?: string;
	properties?: Record<string, unknown> | null;
	geometry?: {
		type?: string;
		coordinates?: unknown;
	} | null;
}

function toRadians(degrees: number): number {
	return (degrees * Math.PI) / 180;
}

function isPosition(value: unknown): value is Position {
	return (
		Array.isArray(value) &&
		value.length >= 2 &&
		typeof value[0] === "number" &&
		typeof value[1] === "number"
	);
}

/**
 * Signed spherical area (square metres) of one closed ring of
 * `[longitude, latitude]` positions. Port of `_ring_area`.
 *
 * Rings with fewer than 3 positions have no area.
 */
export function ringArea(coords: readonly Position[]): number {
	const length = coords.length;
	if (length <= 2) return 0;

	let area = 0;
	for (let i = 0; i < length; i++) {
		let lowerIndex: number;
		let middleIndex: number;
		let upperIndex: number;

		if (i === length - 2) {
			lowerIndex = length - 2;
			middleIndex = length - 1;
			upperIndex = 0;
		} else if (i === length - 1) {
			lowerIndex = length - 1;
			middleIndex = 0;
			upperIndex = 1;
		} else {
			lowerIndex = i;
			middleIndex = i + 1;
			upperIndex = i + 2;
		}

		const p1 = coords[lowerIndex];
		const p2 = coords[middleIndex];
		const p3 = coords[upperIndex];
		area += (toRadians(p3[0]) - toRadians(p1[0])) * Math.sin(toRadians(p2[1]));
	}

	return (area * EARTH_RADIUS * EARTH_RADIUS) / 2;
}

/**
 * Area of a GeoJSON Polygon: outer ring minus every hole. Port of
 * `_polygon_area`. Ring orientation does not matter (absolute values).
 */
export function polygonArea(rings: readonly (readonly Position[])[]): number {
	if (!rings || rings.length === 0) return 0;

	let area = Math.abs(ringArea(rings[0]));
	for (let i = 1; i < rings.length; i++) {
		area -= Math.abs(ringArea(rings[i]));
	}
	return area;
}

/**
 * Total area (square metres) of a set of GeoJSON features. Port of
 * `compute_area`: sums `Polygon` features (outer ring minus holes) and
 * circle `Point` features (`properties.point_type === "circle"`, pi * r^2
 * with `properties.radius` in metres). Every other geometry contributes 0.
 *
 * Unlike ERPNext, malformed features (missing coordinates, non-numeric
 * radius) contribute 0 instead of raising.
 */
export function computeArea(
	features: readonly AreaFeature[] | null | undefined,
): number {
	if (!features) return 0;

	let layerArea = 0;
	for (const feature of features) {
		const geometry = feature?.geometry;
		const type = geometry?.type;

		if (type === "Polygon") {
			const rings = geometry?.coordinates;
			if (
				Array.isArray(rings) &&
				rings.every(
					(ring) => Array.isArray(ring) && ring.every(isPosition),
				)
			) {
				layerArea += polygonArea(rings as Position[][]);
			}
		} else if (
			type === "Point" &&
			feature.properties?.point_type === "circle"
		) {
			const radius = feature.properties.radius;
			if (typeof radius === "number" && Number.isFinite(radius)) {
				layerArea += Math.PI * radius ** 2;
			}
		}
	}
	return layerArea;
}
