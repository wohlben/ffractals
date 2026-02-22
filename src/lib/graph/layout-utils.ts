import type { AggregatedEdge, AggregatedItem } from "./totals-builder";

export const NODE_BASE_WIDTH = 220;
export const X_GAP = 80;
export const Y_SPACING = 360;
export const START_X = 100;
export const START_Y = 100;

export interface Position {
	x: number;
	y: number;
}

export interface LayoutContext {
	itemMap: Map<number, AggregatedItem>;
	edgeMap: Map<string, AggregatedEdge>;
	connections: AggregatedEdge[];
	consumersOf: Map<number, Set<number>>;
	suppliersOf: Map<number, Set<number>>;
	itemDepth: Map<number, number>;
	displayRow: Map<number, number>;
	consumerCount: Map<number, number>;
	rootItemTargets: Map<number, string[]>;
}

export interface LayoutState {
	positions: Map<number, Position>;
	connections: AggregatedEdge[];
	itemMap: Map<number, AggregatedItem>;
}

export interface MoveResult {
	newPositions: Map<number, Position>;
	affectedItems: Set<number>;
}

/**
 * Get all downstream children (suppliers) of an item recursively
 */
export function getAllChildren(
	itemId: number,
	context: LayoutContext,
): number[] {
	const children: number[] = [];
	const visited = new Set<number>();

	function traverse(currentId: number): void {
		if (visited.has(currentId)) return;
		visited.add(currentId);

		const suppliers = context.suppliersOf.get(currentId);
		if (suppliers) {
			for (const supplierId of suppliers) {
				children.push(supplierId);
				traverse(supplierId);
			}
		}
	}

	traverse(itemId);
	return children;
}

/**
 * Get the width of a node based on its content
 */
export function getNodeWidth(itemId: number, context: LayoutContext): number {
	const agg = context.itemMap.get(itemId);
	if (!agg) return NODE_BASE_WIDTH;
	return Math.max(NODE_BASE_WIDTH, agg.supplierItemIds.size * 48 + 32);
}

/**
 * Check if a proposed position overlaps with any existing items in the same row
 */
export function overlapsAny(
	position: Position,
	width: number,
	rowItems: Array<{ id: number; x: number; width: number }>,
	gap: number,
): boolean {
	const halfWidth = width / 2;
	for (const item of rowItems) {
		const itemHalfWidth = item.width / 2;
		if (
			position.x + halfWidth + gap > item.x - itemHalfWidth &&
			position.x - halfWidth - gap < item.x + itemHalfWidth
		) {
			return true;
		}
	}
	return false;
}

/**
 * Count edge crossings for a given item placement
 */
export function countEdgeCrossings(
	itemId: number,
	positions: Map<number, Position>,
	context: LayoutContext,
): number {
	const itemPos = positions.get(itemId);
	if (!itemPos) return 0;

	const consumers = context.consumersOf.get(itemId) ?? new Set();
	const suppliers = context.suppliersOf.get(itemId) ?? new Set();

	let crossings = 0;

	// Count crossings with consumer connections
	for (const consumerId of consumers) {
		const consumerPos = positions.get(consumerId);
		if (!consumerPos) continue;

		// Check against all other edges
		for (const edge of context.connections) {
			if (edge.sourceItemId === itemId || edge.targetItemId === itemId)
				continue;
			if (edge.targetItemId === consumerId) continue;

			const sourcePos = positions.get(edge.sourceItemId);
			const targetPos = positions.get(edge.targetItemId);
			if (!sourcePos || !targetPos) continue;

			if (linesIntersect(itemPos, consumerPos, sourcePos, targetPos)) {
				crossings++;
			}
		}
	}

	// Count crossings with supplier connections
	for (const supplierId of suppliers) {
		const supplierPos = positions.get(supplierId);
		if (!supplierPos) continue;

		// Check against all other edges
		for (const edge of context.connections) {
			if (edge.sourceItemId === itemId || edge.targetItemId === itemId)
				continue;
			if (edge.sourceItemId === supplierId) continue;

			const sourcePos = positions.get(edge.sourceItemId);
			const targetPos = positions.get(edge.targetItemId);
			if (!sourcePos || !targetPos) continue;

			if (linesIntersect(itemPos, supplierPos, sourcePos, targetPos)) {
				crossings++;
			}
		}
	}

	return crossings;
}

/**
 * Check if two line segments intersect
 */
function linesIntersect(
	a1: Position,
	a2: Position,
	b1: Position,
	b2: Position,
): boolean {
	// Simple bounding box check first
	const aMinX = Math.min(a1.x, a2.x);
	const aMaxX = Math.max(a1.x, a2.x);
	const aMinY = Math.min(a1.y, a2.y);
	const aMaxY = Math.max(a1.y, a2.y);
	const bMinX = Math.min(b1.x, b2.x);
	const bMaxX = Math.max(b1.x, b2.x);
	const bMinY = Math.min(b1.y, b2.y);
	const bMaxY = Math.max(b1.y, b2.y);

	if (aMaxX < bMinX || bMaxX < aMinX || aMaxY < bMinY || bMaxY < aMinY) {
		return false;
	}

	// Check if lines actually intersect using cross products
	const d1 = direction(b1, b2, a1);
	const d2 = direction(b1, b2, a2);
	const d3 = direction(a1, a2, b1);
	const d4 = direction(a1, a2, b2);

	return (
		((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
		((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
	);
}

function direction(a: Position, b: Position, c: Position): number {
	return (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
}

/**
 * Move an item and all its downstream children (suppliers) by a delta
 * When moving a parent, all children move with it to maintain connection topology
 */
export function moveWithChildren(
	itemId: number,
	newPosition: Position,
	state: LayoutState,
): MoveResult {
	const currentPos = state.positions.get(itemId);
	if (!currentPos) {
		return {
			newPositions: new Map([[itemId, newPosition]]),
			affectedItems: new Set([itemId]),
		};
	}

	const deltaX = newPosition.x - currentPos.x;
	const deltaY = newPosition.y - currentPos.y;

	const newPositions = new Map<number, Position>();
	const affectedItems = new Set<number>();

	// Move the target item
	newPositions.set(itemId, newPosition);
	affectedItems.add(itemId);

	// Recursively move all downstream children (suppliers)
	function moveChildren(currentId: number): void {
		const agg = state.itemMap.get(currentId);
		if (!agg) return;

		for (const supplierId of agg.supplierItemIds) {
			if (affectedItems.has(supplierId)) continue;

			const supplierPos = state.positions.get(supplierId);
			if (supplierPos) {
				const newSupplierPos: Position = {
					x: supplierPos.x + deltaX,
					y: supplierPos.y + deltaY,
				};
				newPositions.set(supplierId, newSupplierPos);
				affectedItems.add(supplierId);

				// Recursively move this supplier's children
				moveChildren(supplierId);
			}
		}
	}

	moveChildren(itemId);

	// Merge with existing positions
	for (const [id, pos] of state.positions) {
		if (!newPositions.has(id)) {
			newPositions.set(id, pos);
		}
	}

	return { newPositions, affectedItems };
}

/**
 * Find the best non-overlapping position near an ideal position
 */
export function findBestPosition(
	itemId: number,
	idealPosition: Position,
	existingPositions: Map<number, Position>,
	context: LayoutContext,
): Position {
	const width = getNodeWidth(itemId, context);
	const halfWidth = width / 2;

	// Collect positions of items in the same row
	const row = context.displayRow.get(itemId) ?? 0;
	const rowItems: Array<{ id: number; x: number; width: number }> = [];

	for (const [id, pos] of existingPositions) {
		const otherRow = context.displayRow.get(id);
		if (otherRow === row) {
			rowItems.push({
				id,
				x: pos.x,
				width: getNodeWidth(id, context),
			});
		}
	}

	rowItems.sort((a, b) => a.x - b.x);

	// Try positions in order of preference
	const candidates: Position[] = [idealPosition];

	// Add positions to the right of each existing item
	for (const item of rowItems) {
		candidates.push({
			x: item.x + item.width / 2 + X_GAP + halfWidth,
			y: idealPosition.y,
		});
	}

	// Add position before first item
	if (rowItems.length > 0) {
		const first = rowItems[0];
		candidates.push({
			x: first.x - first.width / 2 - X_GAP - halfWidth,
			y: idealPosition.y,
		});
	}

	// Find first non-overlapping position closest to ideal
	for (const candidate of candidates) {
		if (!overlapsAny(candidate, width, rowItems, X_GAP)) {
			return candidate;
		}
	}

	// Fallback: place at the end
	if (rowItems.length > 0) {
		const last = rowItems[rowItems.length - 1];
		return {
			x: last.x + last.width / 2 + X_GAP + halfWidth,
			y: idealPosition.y,
		};
	}

	return idealPosition;
}

/**
 * Find best position with a wider search radius
 */
export function findBestPositionWithRadius(
	itemId: number,
	idealPosition: Position,
	existingPositions: Map<number, Position>,
	context: LayoutContext,
	searchRadius: number,
): Position {
	const width = getNodeWidth(itemId, context);
	const halfWidth = width / 2;

	// Collect positions of items in the same row
	const row = context.displayRow.get(itemId) ?? 0;
	const rowItems: Array<{ id: number; x: number; width: number }> = [];

	for (const [id, pos] of existingPositions) {
		const otherRow = context.displayRow.get(id);
		if (otherRow === row) {
			rowItems.push({
				id,
				x: pos.x,
				width: getNodeWidth(id, context),
			});
		}
	}

	rowItems.sort((a, b) => a.x - b.x);

	// Generate candidate positions
	const candidates: Position[] = [idealPosition];

	// Add positions at various distances from ideal
	const baseSpacing = width + X_GAP;
	for (let i = 1; i <= searchRadius; i++) {
		candidates.push({
			x: idealPosition.x + baseSpacing * i,
			y: idealPosition.y,
		});
		candidates.push({
			x: idealPosition.x - baseSpacing * i,
			y: idealPosition.y,
		});
	}

	// Find best non-overlapping position closest to ideal
	let bestPosition = idealPosition;
	let bestDistance = Number.MAX_SAFE_INTEGER;

	for (const candidate of candidates) {
		if (!overlapsAny(candidate, width, rowItems, X_GAP)) {
			const distance = Math.abs(candidate.x - idealPosition.x);
			if (distance < bestDistance) {
				bestDistance = distance;
				bestPosition = candidate;
			}
		}
	}

	// If all candidates overlap, expand search
	if (bestDistance === Number.MAX_SAFE_INTEGER) {
		// Try placing at far right
		if (rowItems.length > 0) {
			const last = rowItems[rowItems.length - 1];
			return {
				x: last.x + last.width / 2 + X_GAP + halfWidth,
				y: idealPosition.y,
			};
		}
	}

	return bestPosition;
}

/**
 * Generate multiple candidate positions around an ideal position
 */
export function generateCandidatePositions(
	idealPosition: Position,
	existingPositions: Map<number, Position>,
	context: LayoutContext,
	count: number,
): Position[] {
	const candidates: Position[] = [idealPosition];

	// Collect items in same row to understand spacing
	const rowItems: Array<{ x: number; width: number }> = [];
	for (const [id, pos] of existingPositions) {
		rowItems.push({
			x: pos.x,
			width: getNodeWidth(id, context),
		});
	}

	// Generate positions to the left and right
	const avgWidth =
		rowItems.length > 0
			? rowItems.reduce((sum, item) => sum + item.width, 0) / rowItems.length
			: NODE_BASE_WIDTH;
	const spacing = avgWidth + X_GAP;

	for (let i = 1; i <= count / 2; i++) {
		candidates.push({
			x: idealPosition.x + spacing * i,
			y: idealPosition.y,
		});
		candidates.push({
			x: idealPosition.x - spacing * i,
			y: idealPosition.y,
		});
	}

	return candidates;
}

/**
 * Find position that minimizes edge crossings
 */
export function findPositionMinimizingCrossings(
	itemId: number,
	idealPosition: Position,
	existingPositions: Map<number, Position>,
	context: LayoutContext,
): Position {
	const candidates = generateCandidatePositions(
		idealPosition,
		existingPositions,
		context,
		10,
	);

	let bestPosition = idealPosition;
	let minCrossings = Number.MAX_SAFE_INTEGER;

	for (const candidate of candidates) {
		// Temporarily place item
		const tempPositions = new Map(existingPositions);
		tempPositions.set(itemId, candidate);

		// Count edge crossings
		const crossings = countEdgeCrossings(itemId, tempPositions, context);

		if (crossings < minCrossings) {
			minCrossings = crossings;
			bestPosition = candidate;
		}
	}

	return bestPosition;
}
