import {
	findBestPosition,
	findBestPositionWithRadius,
	findPositionMinimizingCrossings,
	getAllChildren,
	getNodeWidth,
	type LayoutContext,
	type LayoutState,
	moveWithChildren,
	type Position,
	START_X,
	START_Y,
	X_GAP,
	Y_SPACING,
} from "./layout-utils";
import type { AggregatedItem } from "./totals-builder";

/**
 * Build vertical chains from leaves (items with no suppliers)
 * Returns chains from bottom to top (raw material → consumer)
 */
function buildVerticalChains(context: LayoutContext): number[][] {
	const chains: number[][] = [];
	const visited = new Set<number>();

	// Start from leaves (raw materials) and build upward chains
	const leaves = Array.from(context.itemMap.values()).filter(
		(item) => item.supplierItemIds.size === 0,
	);

	for (const leaf of leaves) {
		if (visited.has(leaf.itemId)) continue;

		const chain: number[] = [];
		let currentId: number | undefined = leaf.itemId;

		// Walk upward while item has exactly 1 consumer
		while (currentId !== undefined) {
			const consumers = context.consumersOf.get(currentId);

			if (consumers && consumers.size === 1 && !visited.has(currentId)) {
				chain.push(currentId);
				visited.add(currentId);
				currentId = consumers.values().next().value;
			} else {
				break;
			}
		}

		if (chain.length > 0) {
			chains.push(chain); // chain is bottom-to-top
		}
	}

	return chains;
}

/**
 * Phase 1: Place all single-consumer items (1:1 connections)
 * These items should ALWAYS be vertically aligned with their consumer
 */
export function placeSingleConsumerItems(
	context: LayoutContext,
): Map<number, Position> {
	const positions = new Map<number, Position>();
	const chains = buildVerticalChains(context);

	// Sort chains by the topmost item's position for consistent ordering
	chains.sort((a, b) => {
		const topA = a[a.length - 1]; // topmost item
		const topB = b[b.length - 1];
		// Use itemId as initial ordering heuristic
		return topA - topB;
	});

	// Place chains from left to right
	let currentX = START_X;
	for (const chain of chains) {
		const topItemId = chain[chain.length - 1];
		const topWidth = getNodeWidth(topItemId, context);

		// Place entire chain vertically aligned at currentX + width/2
		for (let i = 0; i < chain.length; i++) {
			const itemId = chain[i];
			const row = context.displayRow.get(itemId) ?? 0;

			positions.set(itemId, {
				x: currentX + topWidth / 2,
				y: START_Y + row * Y_SPACING,
			});
		}

		currentX += topWidth + X_GAP;
	}

	return positions;
}

/**
 * Get items with a specific consumer count
 */
function getItemsWithConsumerCount(
	count: number,
	context: LayoutContext,
	orMore: boolean = false,
): AggregatedItem[] {
	return Array.from(context.itemMap.values()).filter((item) => {
		const consumerCount = context.consumerCount.get(item.itemId) ?? 0;
		return orMore ? consumerCount >= count : consumerCount === count;
	});
}

/**
 * Phase 2: Place items with exactly 2 consumers
 * Position them to minimize edge crossings and connection distance
 */
export function placeTwoConsumerItems(
	context: LayoutContext,
	existingPositions: Map<number, Position>,
): Map<number, Position> {
	const positions = new Map(existingPositions);
	const items = getItemsWithConsumerCount(2, context);

	// Sort by display row (process bottom-up to respect dependencies)
	items.sort((a, b) => {
		const rowA = context.displayRow.get(a.itemId) ?? 0;
		const rowB = context.displayRow.get(b.itemId) ?? 0;
		return rowA - rowB;
	});

	for (const item of items) {
		const consumers = Array.from(context.consumersOf.get(item.itemId) ?? []);
		if (consumers.length !== 2) continue;

		// Calculate ideal position: midpoint between consumers
		const consumerPositions = consumers
			.map((id) => positions.get(id))
			.filter((pos): pos is Position => pos !== undefined);

		let idealX: number;
		if (consumerPositions.length === 2) {
			idealX = (consumerPositions[0].x + consumerPositions[1].x) / 2;
		} else if (consumerPositions.length === 1) {
			idealX = consumerPositions[0].x;
		} else {
			// Consumers not yet placed, use START_X
			idealX = START_X;
		}

		const row = context.displayRow.get(item.itemId) ?? 0;
		const idealPosition = { x: idealX, y: START_Y + row * Y_SPACING };

		// Find best non-overlapping position near ideal
		const bestPosition = findBestPosition(
			item.itemId,
			idealPosition,
			positions,
			context,
		);

		// Check if any children need to move with this item
		const children = getAllChildren(item.itemId, context);
		const placedChildren = children.filter((id) => positions.has(id));

		if (placedChildren.length > 0) {
			const state: LayoutState = {
				positions,
				connections: context.connections,
				itemMap: context.itemMap,
			};
			const result = moveWithChildren(item.itemId, bestPosition, state);

			for (const [id, pos] of result.newPositions) {
				positions.set(id, pos);
			}
		} else {
			positions.set(item.itemId, bestPosition);
		}
	}

	return positions;
}

/**
 * Phase 3: Place items with exactly 3 consumers
 */
export function placeThreeConsumerItems(
	context: LayoutContext,
	existingPositions: Map<number, Position>,
): Map<number, Position> {
	const positions = new Map(existingPositions);
	const items = getItemsWithConsumerCount(3, context);

	// Sort by display row (bottom-up)
	items.sort((a, b) => {
		const rowA = context.displayRow.get(a.itemId) ?? 0;
		const rowB = context.displayRow.get(b.itemId) ?? 0;
		return rowA - rowB;
	});

	for (const item of items) {
		const consumers = Array.from(context.consumersOf.get(item.itemId) ?? []);
		if (consumers.length !== 3) continue;

		// Calculate barycenter of consumers
		const consumerXs = consumers
			.map((id) => positions.get(id)?.x)
			.filter((x): x is number => x !== undefined);

		let idealX: number;
		if (consumerXs.length > 0) {
			idealX = consumerXs.reduce((sum, x) => sum + x, 0) / consumerXs.length;
		} else {
			idealX = START_X;
		}

		const row = context.displayRow.get(item.itemId) ?? 0;
		const idealPosition = { x: idealX, y: START_Y + row * Y_SPACING };

		// Find best position with wider search radius than 2-consumer
		const bestPosition = findBestPositionWithRadius(
			item.itemId,
			idealPosition,
			positions,
			context,
			3, // Allow looking 3 positions away from ideal
		);

		// Apply moveWithChildren if needed
		const children = getAllChildren(item.itemId, context);
		const placedChildren = children.filter((id) => positions.has(id));

		if (placedChildren.length > 0) {
			const state: LayoutState = {
				positions,
				connections: context.connections,
				itemMap: context.itemMap,
			};
			const result = moveWithChildren(item.itemId, bestPosition, state);

			for (const [id, pos] of result.newPositions) {
				positions.set(id, pos);
			}
		} else {
			positions.set(item.itemId, bestPosition);
		}
	}

	return positions;
}

/**
 * Phase 4: Place items with 4+ consumers
 */
export function placeManyConsumerItems(
	context: LayoutContext,
	existingPositions: Map<number, Position>,
): Map<number, Position> {
	const positions = new Map(existingPositions);
	const items = getItemsWithConsumerCount(4, context, true);

	// Sort by display row (bottom-up)
	items.sort((a, b) => {
		const rowA = context.displayRow.get(a.itemId) ?? 0;
		const rowB = context.displayRow.get(b.itemId) ?? 0;
		return rowA - rowB;
	});

	for (const item of items) {
		const consumers = Array.from(context.consumersOf.get(item.itemId) ?? []);

		// Calculate barycenter of all consumers
		const consumerXs = consumers
			.map((id) => positions.get(id)?.x)
			.filter((x): x is number => x !== undefined);

		let idealX: number;
		if (consumerXs.length > 0) {
			idealX = consumerXs.reduce((sum, x) => sum + x, 0) / consumerXs.length;
		} else {
			idealX = START_X;
		}

		const row = context.displayRow.get(item.itemId) ?? 0;
		const idealPosition = { x: idealX, y: START_Y + row * Y_SPACING };

		// For many consumers, we care more about edge crossings than exact position
		const bestPosition = findPositionMinimizingCrossings(
			item.itemId,
			idealPosition,
			positions,
			context,
		);

		// Apply moveWithChildren if needed
		const children = getAllChildren(item.itemId, context);
		const placedChildren = children.filter((id) => positions.has(id));

		if (placedChildren.length > 0) {
			const state: LayoutState = {
				positions,
				connections: context.connections,
				itemMap: context.itemMap,
			};
			const result = moveWithChildren(item.itemId, bestPosition, state);

			for (const [id, pos] of result.newPositions) {
				positions.set(id, pos);
			}
		} else {
			positions.set(item.itemId, bestPosition);
		}
	}

	return positions;
}

/**
 * Check if an item is part of a rigid 1:1 chain
 */
function isInRigidChain(itemId: number, context: LayoutContext): boolean {
	const consumerCount = context.consumerCount.get(itemId) ?? 0;
	if (consumerCount !== 1) return false;

	// Check if consumer also has exactly 1 supplier
	const consumers = context.consumersOf.get(itemId);
	if (!consumers || consumers.size !== 1) return false;

	const consumerId = consumers.values().next().value;
	if (consumerId === undefined) return false;

	const consumerSuppliers = context.suppliersOf.get(consumerId);

	return consumerSuppliers !== undefined && consumerSuppliers.size === 1;
}

/**
 * Get all neighbor item IDs (suppliers and consumers)
 */
function getNeighbors(itemId: number, context: LayoutContext): number[] {
	const neighbors: number[] = [];

	const suppliers = context.suppliersOf.get(itemId);
	if (suppliers) {
		neighbors.push(...suppliers);
	}

	const consumers = context.consumersOf.get(itemId);
	if (consumers) {
		neighbors.push(...consumers);
	}

	return neighbors;
}

/**
 * Find best position near desired position with maximum deviation
 */
function findBestPositionNearby(
	itemId: number,
	desiredPosition: Position,
	existingPositions: Map<number, Position>,
	context: LayoutContext,
	maxDeviation: number,
): Position {
	const currentPos = existingPositions.get(itemId);
	if (!currentPos) return desiredPosition;

	const deviation = desiredPosition.x - currentPos.x;
	if (Math.abs(deviation) <= maxDeviation) {
		// Check if we can move to desired position
		const width = getNodeWidth(itemId, context);
		const row = context.displayRow.get(itemId) ?? 0;

		const rowItems: Array<{ id: number; x: number; width: number }> = [];
		for (const [id, pos] of existingPositions) {
			if (id === itemId) continue;
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

		// Check if desired position overlaps
		const halfWidth = width / 2;
		let overlaps = false;
		for (const item of rowItems) {
			const itemHalfWidth = item.width / 2;
			if (
				desiredPosition.x + halfWidth + X_GAP > item.x - itemHalfWidth &&
				desiredPosition.x - halfWidth - X_GAP < item.x + itemHalfWidth
			) {
				overlaps = true;
				break;
			}
		}

		if (!overlaps) {
			return desiredPosition;
		}
	}

	return currentPos;
}

/**
 * Group items by their display row
 */
function groupByRow(
	positions: Map<number, Position>,
	context: LayoutContext,
): Map<number, AggregatedItem[]> {
	const rows = new Map<number, AggregatedItem[]>();

	for (const [itemId, _pos] of positions) {
		const row = context.displayRow.get(itemId) ?? 0;
		const item = context.itemMap.get(itemId);
		if (item) {
			const group = rows.get(row) ?? [];
			group.push(item);
			rows.set(row, group);
		}
	}

	return rows;
}

/**
 * Phase 5: Refinement pass to optimize overall layout quality
 */
export function refineLayout(
	context: LayoutContext,
	positions: Map<number, Position>,
): Map<number, Position> {
	const refined = new Map(positions);

	// Perform 3 iterations of refinement
	for (let iteration = 0; iteration < 3; iteration++) {
		// Process rows from top to bottom
		const rows = groupByRow(refined, context);
		const sortedRows = Array.from(rows.keys()).sort((a, b) => a - b);

		for (const row of sortedRows) {
			const rowItems = rows.get(row) ?? [];

			for (const item of rowItems) {
				// Skip items that are part of rigid 1:1 chains (they stay aligned)
				if (isInRigidChain(item.itemId, context)) continue;

				// Calculate barycenter of neighbors
				const neighbors = getNeighbors(item.itemId, context);
				const neighborPositions = neighbors
					.map((id) => refined.get(id))
					.filter((pos): pos is Position => pos !== undefined);

				if (neighborPositions.length === 0) continue;

				const barycenterX =
					neighborPositions.reduce((sum, pos) => sum + pos.x, 0) /
					neighborPositions.length;

				// Try to move toward barycenter if it doesn't cause overlap
				const currentPos = refined.get(item.itemId);
				if (!currentPos) continue;

				const desiredPos = { ...currentPos, x: barycenterX };
				const bestPos = findBestPositionNearby(
					item.itemId,
					desiredPos,
					refined,
					context,
					100,
				);

				if (bestPos.x !== currentPos.x) {
					// Use moveWithChildren to cascade the adjustment
					const state: LayoutState = {
						positions: refined,
						connections: context.connections,
						itemMap: context.itemMap,
					};
					const result = moveWithChildren(item.itemId, bestPos, state);

					for (const [id, pos] of result.newPositions) {
						refined.set(id, pos);
					}
				}
			}
		}
	}

	return refined;
}
