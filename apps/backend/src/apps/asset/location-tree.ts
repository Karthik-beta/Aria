/**
 * Location tree helpers — pure functions over an in-memory adjacency list.
 *
 * Rules ported from Frappe's NestedSet as used by ERPNext `Location`
 * (a node cannot be its own ancestor), plus the tree assembly behind the
 * hierarchy API. The `totalArea` roll-up replaces ERPNext's
 * `update_ancestor_location_features` (computed at read time, see
 * `location-area.ts`).
 *
 * @module LocationTree
 */
import type { Asset } from "@aria/types";

/** Upper bound for ancestor walks; guards against corrupt (cyclic) data. */
export const MAX_LOCATION_DEPTH = 100;

export interface LocationEdge {
	id: string;
	parentLocationId: string | null;
}

export interface LocationTreeRow extends LocationEdge {
	name: string;
	isGroup: boolean;
	isContainer: boolean;
	area: number;
	/** Assets assigned directly to this location. */
	assetCount: number;
}

function compareByName(a: { name: string; id: string }, b: typeof a): number {
	return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

/**
 * Ids of the proposed parent and all its ancestors up to the root
 * (nearest first). Stops on a revisited id or after `maxDepth` hops.
 */
export function getAncestorIds(
	startId: string | null | undefined,
	parentById: ReadonlyMap<string, string | null>,
	maxDepth = MAX_LOCATION_DEPTH,
): string[] {
	const chain: string[] = [];
	const visited = new Set<string>();
	let current = startId ?? null;
	while (current && !visited.has(current) && chain.length < maxDepth) {
		visited.add(current);
		chain.push(current);
		current = parentById.get(current) ?? null;
	}
	return chain;
}

/**
 * True when making `proposedParentId` the parent of `locationId` would
 * create a cycle: the location itself, or one of its descendants, is the
 * proposed parent (i.e. `locationId` is in the proposed parent's ancestor
 * chain, inclusive).
 */
export function wouldCreateCycle(
	locationId: string,
	proposedParentId: string,
	edges: readonly LocationEdge[],
): boolean {
	const parentById = new Map(edges.map((e) => [e.id, e.parentLocationId]));
	return getAncestorIds(proposedParentId, parentById).includes(locationId);
}

/** The location id plus the ids of every descendant (breadth first). */
export function collectSubtreeIds(
	rootId: string,
	edges: readonly LocationEdge[],
): Set<string> {
	const childrenByParent = new Map<string, string[]>();
	for (const edge of edges) {
		if (!edge.parentLocationId) continue;
		const list = childrenByParent.get(edge.parentLocationId);
		if (list) list.push(edge.id);
		else childrenByParent.set(edge.parentLocationId, [edge.id]);
	}

	const subtree = new Set<string>([rootId]);
	const queue = [rootId];
	while (queue.length > 0) {
		const current = queue.shift() as string;
		for (const childId of childrenByParent.get(current) ?? []) {
			if (subtree.has(childId)) continue;
			subtree.add(childId);
			queue.push(childId);
		}
	}
	return subtree;
}

export interface BuildLocationTreeOptions {
	/** Return only this node (with its subtree) instead of all roots. */
	rootId?: string;
	/** Include non-group (leaf) locations. Defaults to true. */
	includeLeaves?: boolean;
}

/**
 * Assemble the nested tree, ordered by name at every level. Counts and
 * `totalArea` always cover the full subtree, even when `includeLeaves` is
 * false. Nodes unreachable from a root (corrupt cyclic data) are omitted.
 * Returns an empty array when `rootId` is unknown.
 */
export function buildLocationTree(
	rows: readonly LocationTreeRow[],
	options: BuildLocationTreeOptions = {},
): Asset.LocationTreeNode[] {
	const includeLeaves = options.includeLeaves ?? true;

	const childrenByParent = new Map<string | null, LocationTreeRow[]>();
	const byId = new Map<string, LocationTreeRow>();
	for (const row of rows) {
		byId.set(row.id, row);
		const key = row.parentLocationId;
		const list = childrenByParent.get(key);
		if (list) list.push(row);
		else childrenByParent.set(key, [row]);
	}
	for (const list of childrenByParent.values()) list.sort(compareByName);

	const build = (
		row: LocationTreeRow,
		path: ReadonlySet<string>,
	): Asset.LocationTreeNode => {
		const nextPath = new Set(path).add(row.id);
		const allChildren = (childrenByParent.get(row.id) ?? []).filter(
			(child) => !nextPath.has(child.id),
		);
		const builtChildren = allChildren.map((child) => build(child, nextPath));

		return {
			id: row.id,
			name: row.name,
			parentLocationId: row.parentLocationId,
			isGroup: row.isGroup,
			isContainer: row.isContainer,
			assetCount: row.assetCount,
			totalAssetCount:
				row.assetCount +
				builtChildren.reduce((sum, child) => sum + child.totalAssetCount, 0),
			childCount: allChildren.length,
			area: row.area,
			totalArea:
				row.area +
				builtChildren.reduce((sum, child) => sum + child.totalArea, 0),
			children: includeLeaves
				? builtChildren
				: builtChildren.filter((child) => child.isGroup),
		};
	};

	let roots: LocationTreeRow[];
	if (options.rootId) {
		const root = byId.get(options.rootId);
		roots = root ? [root] : [];
	} else {
		roots = childrenByParent.get(null) ?? [];
	}
	return roots.map((root) => build(root, new Set()));
}
