import type {
	Byproduct,
	CalculationContext,
	CalculationElement,
	CalculationTarget,
	ExtractionSource,
	FacilityConfig,
	FacilitySummary,
	GlobalDefaults,
	MiningSource,
	ModifierConfig,
	RateBreakdown,
	RecipeSource,
	ResourceNeeds,
} from "./models";
import {
	DEFAULT_PROLIFERATOR_CHARGES,
	getProliferatorMultiplier,
	PROLIFERATOR_CHARGES,
	type ProliferatorConsumption,
	TICKS_PER_SECOND,
} from "./models";

export { getProliferatorMultiplier };

export function generateElementId(): string {
	return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function calculateOutputRate(
	outputCount: number,
	recipeTime: number,
	facilitySpeed: number,
	modifier: ModifierConfig,
): number {
	const baseRate = outputCount / (recipeTime / TICKS_PER_SECOND);
	const speedMultiplier =
		facilitySpeed * getProliferatorMultiplier(modifier.mode, modifier.level);
	return baseRate * speedMultiplier;
}

export function calculateInputRate(
	inputCount: number,
	recipeTime: number,
	facilitySpeed: number,
	modifier: ModifierConfig,
): number {
	const baseRate = inputCount / (recipeTime / TICKS_PER_SECOND);

	if (modifier.mode === "product") {
		// Product mode: inputs are reduced because we get more output per input
		// Input rate = baseRate * speed / productMultiplier
		const productMultiplier = getProliferatorMultiplier(
			"product",
			modifier.level,
		);
		return (baseRate * facilitySpeed) / productMultiplier;
	}

	// Speed mode (or none): inputs scale with speed
	const speedMultiplier =
		facilitySpeed * getProliferatorMultiplier("speed", modifier.level);
	return baseRate * speedMultiplier;
}

export function calculateRequiredFacilities(
	requiredRate: number,
	outputRate: number,
): number {
	if (outputRate <= 0) return 0;
	return requiredRate / outputRate;
}

export function calculateProliferatorConsumption(
	recipeInputs: Array<{ itemId: number; count: number }>,
	recipeTime: number,
	facilitySpeed: number,
	modifier: ModifierConfig,
	facilityCount: number,
	proliferatorItemId: number,
): ProliferatorConsumption | null {
	// No consumption if not using proliferators
	if (modifier.mode === "none" || modifier.level === 0) {
		return null;
	}

	// Calculate total input items per craft
	const totalInputsPerCraft = recipeInputs.reduce(
		(sum, input) => sum + input.count,
		0,
	);

	if (totalInputsPerCraft === 0) {
		return null;
	}

	// Get charges for this proliferator level
	const chargesPerItem =
		PROLIFERATOR_CHARGES[proliferatorItemId] ?? DEFAULT_PROLIFERATOR_CHARGES;

	// Calculate crafts per second per facility
	const craftsPerSecondPerFacility =
		(TICKS_PER_SECOND / recipeTime) * facilitySpeed;
	const totalCraftsPerSecond = craftsPerSecondPerFacility * facilityCount;

	// Charges consumed per craft = total input items (each input item uses 1 charge)
	const chargesPerCraft = totalInputsPerCraft;

	// Charges consumed per second
	const chargesPerSecond = chargesPerCraft * totalCraftsPerSecond;

	// Items consumed per craft (fractional)
	const itemsPerCraft = chargesPerCraft / chargesPerItem;

	// Items consumed per second
	const itemsPerSecond = chargesPerSecond / chargesPerItem;

	return {
		itemId: proliferatorItemId,
		chargesPerCraft,
		itemsPerCraft,
		chargesPerSecond,
		itemsPerSecond,
	};
}

export function calculateMiningRate(miningTime: number): number {
	return (1 / miningTime) * TICKS_PER_SECOND;
}

export function calculateExtractionRate(extractionSpeed: number): number {
	return extractionSpeed;
}

export function calculateGatheringRate(): number {
	return 1;
}

export function createBaseElement(
	itemId: number,
	requiredRate: number,
	parentId: string | null,
	depth: number,
): CalculationElement {
	return {
		id: generateElementId(),
		itemId,
		requiredRate,
		actualRate: 0,
		source: null,
		facility: null,
		inputs: [],
		byproducts: [],
		depth,
		parentIds: parentId ? [parentId] : [],
	};
}

export function createFacilityConfig(
	recipeType: string,
	context: CalculationContext,
	defaults: GlobalDefaults,
	customFacilityId?: number,
	customModifier?: ModifierConfig,
): FacilityConfig {
	const facilityId = customFacilityId ?? defaults.facilities[recipeType] ?? 0;
	const facilityData = context.getFacilityData(facilityId);

	return {
		itemId: facilityId,
		count: 0,
		speedMultiplier: facilityData?.speedMultiplier ?? 1,
		modifier: customModifier ?? defaults.proliferator,
	};
}

export function expandElementWithRecipe(
	element: CalculationElement,
	recipeId: number,
	context: CalculationContext,
	defaults: GlobalDefaults,
	onChildCreated?: (child: CalculationElement) => void,
): CalculationElement {
	const recipe = context.getRecipeById(recipeId);
	if (!recipe) {
		return element;
	}

	const targetOutput = recipe.outputs.find((o) => o.itemId === element.itemId);
	if (!targetOutput) {
		return element;
	}

	const facility = createFacilityConfig(recipe.type, context, defaults);

	const outputRate = calculateOutputRate(
		targetOutput.count,
		recipe.timeSpend,
		facility.speedMultiplier,
		facility.modifier,
	);

	const facilitiesNeeded = calculateRequiredFacilities(
		element.requiredRate,
		outputRate,
	);
	const actualRate = outputRate * facilitiesNeeded;

	const inputs: string[] = [];
	const byproducts: Byproduct[] = [];

	for (const input of recipe.inputs) {
		const inputRate =
			calculateInputRate(
				input.count,
				recipe.timeSpend,
				facility.speedMultiplier,
				facility.modifier,
			) * facilitiesNeeded;

		const childElement = createBaseElement(
			input.itemId,
			inputRate,
			element.id,
			element.depth + 1,
		);
		inputs.push(childElement.id);
		onChildCreated?.(childElement);
	}

	for (const output of recipe.outputs) {
		if (output.itemId !== element.itemId) {
			const byproductRate =
				calculateOutputRate(
					output.count,
					recipe.timeSpend,
					facility.speedMultiplier,
					facility.modifier,
				) * facilitiesNeeded;

			byproducts.push({
				itemId: output.itemId,
				rate: byproductRate,
				consumedBy: [],
			});
		}
	}

	return {
		...element,
		actualRate,
		source: {
			type: "recipe",
			recipeId,
			recipeType: recipe.type,
		} as RecipeSource,
		facility: {
			...facility,
			count: facilitiesNeeded,
		},
		inputs,
		byproducts,
	};
}

export function setElementToMining(
	element: CalculationElement,
	miningTime: number,
): CalculationElement {
	const rate = calculateMiningRate(miningTime);
	if (rate <= 0) return element;
	const facilitiesNeeded = element.requiredRate / rate;

	return {
		...element,
		actualRate: rate * facilitiesNeeded,
		source: {
			type: "mining",
			veinId: 0,
			miningTime,
		} as MiningSource,
		facility: {
			itemId: 0,
			count: facilitiesNeeded,
			speedMultiplier: 1,
			modifier: { mode: "none", level: 0 },
		},
		inputs: [],
		byproducts: [],
	};
}

export function setElementToExtraction(
	element: CalculationElement,
	extractionSpeed: number,
): CalculationElement {
	const rate = calculateExtractionRate(extractionSpeed);
	if (rate <= 0) return element;
	const facilitiesNeeded = element.requiredRate / rate;

	return {
		...element,
		actualRate: rate * facilitiesNeeded,
		source: {
			type: "extraction",
			themeId: 0,
			extractionSpeed,
			isGas: true,
		} as ExtractionSource,
		facility: {
			itemId: 0,
			count: facilitiesNeeded,
			speedMultiplier: 1,
			modifier: { mode: "none", level: 0 },
		},
		inputs: [],
		byproducts: [],
	};
}

export function setElementFacility(
	element: CalculationElement,
	facilityItemId: number,
	facilitySpeedMultiplier: number,
	context: CalculationContext,
	_defaults: GlobalDefaults,
): CalculationElement {
	if (!element.source || element.source.type !== "recipe") {
		return element;
	}

	const recipeSource = element.source as RecipeSource;
	const recipe = context.getRecipeById(recipeSource.recipeId);
	if (!recipe) {
		return element;
	}

	const targetOutput = recipe.outputs.find((o) => o.itemId === element.itemId);
	if (!targetOutput) {
		return element;
	}

	const facility: FacilityConfig = {
		itemId: facilityItemId,
		count: 0,
		speedMultiplier: facilitySpeedMultiplier,
		modifier: element.facility?.modifier ?? { mode: "none", level: 0 },
	};

	const outputRate = calculateOutputRate(
		targetOutput.count,
		recipe.timeSpend,
		facility.speedMultiplier,
		facility.modifier,
	);

	const facilitiesNeeded = calculateRequiredFacilities(
		element.requiredRate,
		outputRate,
	);
	const actualRate = outputRate * facilitiesNeeded;

	const inputs: string[] = [];
	const byproducts: Byproduct[] = [];

	for (const input of recipe.inputs) {
		const inputRate =
			calculateInputRate(
				input.count,
				recipe.timeSpend,
				facility.speedMultiplier,
				facility.modifier,
			) * facilitiesNeeded;

		const childElement = createBaseElement(
			input.itemId,
			inputRate,
			element.id,
			element.depth + 1,
		);
		inputs.push(childElement.id);
	}

	for (const output of recipe.outputs) {
		if (output.itemId !== element.itemId) {
			const byproductRate =
				calculateOutputRate(
					output.count,
					recipe.timeSpend,
					facility.speedMultiplier,
					facility.modifier,
				) * facilitiesNeeded;

			byproducts.push({
				itemId: output.itemId,
				rate: byproductRate,
				consumedBy: [],
			});
		}
	}

	return {
		...element,
		actualRate,
		facility: {
			...facility,
			count: facilitiesNeeded,
		},
		inputs,
		byproducts,
	};
}

export function calculateResourceNeeds(
	targets: CalculationTarget[],
	elements: Record<string, CalculationElement>,
): ResourceNeeds {
	const mined = new Map<number, number>();
	const extracted = new Map<number, number>();
	const gathered = new Map<number, number>();

	for (const target of targets) {
		const rootElement = elements[target.rootElementId];
		if (rootElement) {
			collectResourceNeeds(rootElement, elements, mined, extracted, gathered);
		}
	}

	return { mined, extracted, gathered };
}

function collectResourceNeeds(
	element: CalculationElement,
	elements: Record<string, CalculationElement>,
	mined: Map<number, number>,
	extracted: Map<number, number>,
	gathered: Map<number, number>,
): void {
	if (!element.source) {
		for (const childId of element.inputs) {
			const child = elements[childId];
			if (child) {
				collectResourceNeeds(child, elements, mined, extracted, gathered);
			}
		}
		return;
	}

	if (element.source.type === "mining") {
		const current = mined.get(element.itemId) ?? 0;
		mined.set(element.itemId, current + element.requiredRate);
	} else if (element.source.type === "extraction") {
		const current = extracted.get(element.itemId) ?? 0;
		extracted.set(element.itemId, current + element.requiredRate);
	} else if (element.source.type === "gathering") {
		const current = gathered.get(element.itemId) ?? 0;
		gathered.set(element.itemId, current + element.requiredRate);
	}

	for (const childId of element.inputs) {
		const child = elements[childId];
		if (child) {
			collectResourceNeeds(child, elements, mined, extracted, gathered);
		}
	}
}

export function calculateFacilitySummary(
	targets: CalculationTarget[],
	elements: Record<string, CalculationElement>,
): FacilitySummary[] {
	const facilityMap = new Map<number, { count: number; recipeType?: string }>();

	for (const target of targets) {
		const rootElement = elements[target.rootElementId];
		if (rootElement) {
			collectFacilityCounts(rootElement, elements, facilityMap);
		}
	}

	return Array.from(facilityMap.entries()).map(([itemId, data]) => ({
		itemId,
		count: data.count,
		recipeType: data.recipeType,
	}));
}

function collectFacilityCounts(
	element: CalculationElement,
	elements: Record<string, CalculationElement>,
	facilityMap: Map<number, { count: number; recipeType?: string }>,
): void {
	if (!element.source || !element.facility) {
		for (const childId of element.inputs) {
			const child = elements[childId];
			if (child) {
				collectFacilityCounts(child, elements, facilityMap);
			}
		}
		return;
	}

	if (element.source.type === "recipe" && element.facility.itemId > 0) {
		const current = facilityMap.get(element.facility.itemId);
		if (current) {
			current.count += element.facility.count;
		} else {
			const recipeSource = element.source as RecipeSource;
			facilityMap.set(element.facility.itemId, {
				count: element.facility.count,
				recipeType: recipeSource.recipeType,
			});
		}
	}

	for (const childId of element.inputs) {
		const child = elements[childId];
		if (child) {
			collectFacilityCounts(child, elements, facilityMap);
		}
	}
}

export function calculateRateBreakdown(
	targets: CalculationTarget[],
	elements: Record<string, CalculationElement>,
): RateBreakdown[] {
	const itemMap = new Map<number, { required: number; produced: number }>();

	for (const target of targets) {
		const rootElement = elements[target.rootElementId];
		if (rootElement) {
			collectRateBreakdown(rootElement, elements, itemMap);
		}
	}

	return Array.from(itemMap.entries()).map(([itemId, data]) => ({
		itemId,
		requiredRate: data.required,
		producedRate: data.produced,
		surplusRate: Math.max(0, data.produced - data.required),
	}));
}

function collectRateBreakdown(
	element: CalculationElement,
	elements: Record<string, CalculationElement>,
	itemMap: Map<number, { required: number; produced: number }>,
): void {
	const current = itemMap.get(element.itemId) ?? { required: 0, produced: 0 };
	current.required += element.requiredRate;

	if (element.source) {
		current.produced += element.actualRate;
	}

	itemMap.set(element.itemId, current);

	for (const byproduct of element.byproducts) {
		const bpCurrent = itemMap.get(byproduct.itemId) ?? {
			required: 0,
			produced: 0,
		};
		bpCurrent.produced += byproduct.rate;
		itemMap.set(byproduct.itemId, bpCurrent);
	}

	for (const childId of element.inputs) {
		const child = elements[childId];
		if (child) {
			collectRateBreakdown(child, elements, itemMap);
		}
	}
}

export function recalculateSubtree(
	elementId: string,
	elements: Record<string, CalculationElement>,
	context: CalculationContext,
): Record<string, CalculationElement> {
	const updates: Record<string, CalculationElement> = {};
	const visited = new Set<string>();

	function walk(id: string): void {
		if (visited.has(id)) return;
		visited.add(id);

		const element = updates[id] ?? elements[id];
		if (!element || !element.source) return;

		let updated: CalculationElement;

		if (element.source.type === "recipe") {
			const recipeSource = element.source as RecipeSource;
			const recipe = context.getRecipeById(recipeSource.recipeId);
			if (!recipe || !element.facility) return;

			const targetOutput = recipe.outputs.find(
				(o) => o.itemId === element.itemId,
			);
			if (!targetOutput) return;

			const outputRate = calculateOutputRate(
				targetOutput.count,
				recipe.timeSpend,
				element.facility.speedMultiplier,
				element.facility.modifier,
			);

			const facilitiesNeeded = calculateRequiredFacilities(
				element.requiredRate,
				outputRate,
			);

			// Recalculate children's requiredRate based on new facility count
			for (let i = 0; i < element.inputs.length; i++) {
				const childId = element.inputs[i];
				const child = updates[childId] ?? elements[childId];
				if (!child) continue;

				const input = recipe.inputs[i];
				if (!input) continue;

				const inputRate =
					calculateInputRate(
						input.count,
						recipe.timeSpend,
						element.facility.speedMultiplier,
						element.facility.modifier,
					) * facilitiesNeeded;

				updates[childId] = { ...child, requiredRate: inputRate };
			}

			const facility = element.facility;
			const byproducts = recipe.outputs
				.filter((o) => o.itemId !== element.itemId)
				.map((output) => ({
					itemId: output.itemId,
					rate:
						calculateOutputRate(
							output.count,
							recipe.timeSpend,
							facility.speedMultiplier,
							facility.modifier,
						) * facilitiesNeeded,
					consumedBy: [] as string[],
				}));

			updated = {
				...element,
				actualRate: outputRate * facilitiesNeeded,
				facility: { ...facility, count: facilitiesNeeded },
				byproducts,
			};
		} else if (element.source.type === "mining") {
			const miningSource = element.source as MiningSource;
			const rate = calculateMiningRate(miningSource.miningTime);
			const facilitiesNeeded = rate > 0 ? element.requiredRate / rate : 0;
			updated = {
				...element,
				actualRate: rate * facilitiesNeeded,
				facility: element.facility
					? { ...element.facility, count: facilitiesNeeded }
					: null,
			};
		} else if (element.source.type === "extraction") {
			const extractionSource = element.source as ExtractionSource;
			const rate = calculateExtractionRate(extractionSource.extractionSpeed);
			const facilitiesNeeded = rate > 0 ? element.requiredRate / rate : 0;
			updated = {
				...element,
				actualRate: rate * facilitiesNeeded,
				facility: element.facility
					? { ...element.facility, count: facilitiesNeeded }
					: null,
			};
		} else {
			return;
		}

		updates[id] = updated;

		// Recurse into children
		for (const childId of element.inputs) {
			walk(childId);
		}
	}

	walk(elementId);
	return updates;
}

export function flattenGraph(
	rootElement: CalculationElement,
	elements: Record<string, CalculationElement>,
): CalculationElement[] {
	const flat: CalculationElement[] = [];
	const visited = new Set<string>();

	function visit(element: CalculationElement) {
		if (visited.has(element.id)) return;
		visited.add(element.id);
		flat.push(element);

		for (const childId of element.inputs) {
			const child = elements[childId];
			if (child) visit(child);
		}
	}

	visit(rootElement);

	return flat;
}
