import type { RecipeType as RecipeTypeData } from "../data/models";

// Re-export RecipeType for use in calculator
export type RecipeType = RecipeTypeData;

export type SourceType = "recipe" | "mining" | "extraction" | "gathering";

export type ProliferatorMode = "speed" | "product" | "none";

export interface ModifierConfig {
	mode: ProliferatorMode;
	level: number;
}

export interface RecipeSource {
	type: "recipe";
	recipeId: number;
	recipeType?: string;
}

export interface MiningSource {
	type: "mining";
	veinId: number;
	miningTime: number;
}

export interface ExtractionSource {
	type: "extraction";
	themeId: number;
	extractionSpeed: number;
	isGas: boolean;
}

export interface GatheringSource {
	type: "gathering";
	note: string;
}

export type ElementSource =
	| RecipeSource
	| MiningSource
	| ExtractionSource
	| GatheringSource;

export interface Byproduct {
	itemId: number;
	rate: number;
	consumedBy: string[];
}

export interface FacilityConfig {
	itemId: number;
	count: number;
	speedMultiplier: number;
	modifier: ModifierConfig;
}

export interface CalculationElement {
	id: string;
	itemId: number;
	requiredRate: number;
	actualRate: number;
	source: ElementSource | null;
	facility: FacilityConfig | null;
	inputs: string[];
	byproducts: Byproduct[];
	depth: number;
	parentIds: string[];
}

export interface CalculationTarget {
	id: string;
	itemId: number;
	targetRate: number;
	rootElementId: string;
}

export interface GlobalDefaults {
	facilities: Record<RecipeType, number | undefined>;
	proliferator: ModifierConfig;
}

export interface ViewState {
	scale: number;
	translateX: number;
	translateY: number;
}

export interface NodePosition {
	elementId: string;
	x: number;
	y: number;
}

export interface CalculatorState {
	targets: CalculationTarget[];
	globalDefaults: GlobalDefaults;
	viewState?: ViewState;
	nodePositions: NodePosition[];
	elements: Record<string, CalculationElement>;
	selectedElementId: string | null;
}

export interface RateBreakdown {
	itemId: number;
	requiredRate: number;
	producedRate: number;
	surplusRate: number;
}

export interface FacilitySummary {
	itemId: number;
	count: number;
	recipeType?: string;
}

export interface ResourceNeeds {
	mined: Map<number, number>;
	extracted: Map<number, number>;
	gathered: Map<number, number>;
}

export const PROLIFERATOR_SPEED_MULTIPLIERS: Record<number, number> = {
	0: 1,
	1: 1.25,
	2: 1.5,
	3: 1.75,
};

export const PROLIFERATOR_PRODUCT_MULTIPLIERS: Record<number, number> = {
	0: 1,
	1: 1.125,
	2: 1.2,
	3: 1.25,
};

export const TICKS_PER_SECOND = 60;

export function getProliferatorMultiplier(
	mode: ProliferatorMode,
	level: number,
): number {
	if (mode === "none" || level === 0) return 1;

	const clampedLevel = Math.max(0, Math.min(3, level));

	if (mode === "speed") {
		return PROLIFERATOR_SPEED_MULTIPLIERS[clampedLevel];
	}

	return PROLIFERATOR_PRODUCT_MULTIPLIERS[clampedLevel];
}

export interface RecipeInput {
	itemId: number;
	count: number;
}

export interface RecipeOutput {
	itemId: number;
	count: number;
}

export interface RecipeData {
	id: number;
	type: string;
	timeSpend: number;
	inputs: RecipeInput[];
	outputs: RecipeOutput[];
}

export interface FacilityData {
	itemId: number;
	speedMultiplier: number;
}

export interface CalculationContext {
	getRecipeById(id: number): RecipeData | undefined;
	getItemById(id: number): { ID: number; Name: string } | undefined;
	getDefaultRecipeForItem(itemId: number): number | undefined;
	getDefaultFacilityForRecipeType(recipeType: string): number | undefined;
	getFacilityData(itemId: number): FacilityData | undefined;
	getMiningTime(itemId: number): number | undefined;
	getExtractionSpeed(itemId: number): number | undefined;
}
