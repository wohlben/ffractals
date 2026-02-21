import protoSetsData from "../../assets/protosets.json";
import type {
	Item,
	ProtoSets,
	Recipe,
	RecipeType,
	Tech,
	Theme,
	Vein,
} from "./models";

export class DSPData {
	// Raw data arrays
	static items: Item[] = (protoSetsData as unknown as ProtoSets).ItemProtoSet
		.dataArray;
	static recipes: Recipe[] = (protoSetsData as unknown as ProtoSets)
		.RecipeProtoSet.dataArray;
	static techs: Tech[] = (protoSetsData as unknown as ProtoSets).TechProtoSet
		.dataArray;
	static themes: Theme[] = (protoSetsData as unknown as ProtoSets).ThemeProtoSet
		.dataArray;
	static veins: Vein[] = (protoSetsData as unknown as ProtoSets).VeinProtoSet
		.dataArray;
	static version: string = (protoSetsData as unknown as ProtoSets).version;

	// Lookup maps for O(1) access
	static itemsById: Record<number, Item> = this.items.reduce(
		(acc, item) => ({ ...acc, [item.ID]: item }),
		{} as Record<number, Item>,
	);

	static recipesById: Record<number, Recipe> = this.recipes.reduce(
		(acc, recipe) => ({ ...acc, [recipe.ID]: recipe }),
		{} as Record<number, Recipe>,
	);

	static techsById: Record<number, Tech> = this.techs.reduce(
		(acc, tech) => ({ ...acc, [tech.ID]: tech }),
		{} as Record<number, Tech>,
	);

	static themesById: Record<number, Theme> = this.themes.reduce(
		(acc, theme) => ({ ...acc, [theme.ID]: theme }),
		{} as Record<number, Theme>,
	);

	static veinsById: Record<number, Vein> = this.veins.reduce(
		(acc, vein) => ({ ...acc, [vein.ID]: vein }),
		{} as Record<number, Vein>,
	);

	// Derived Sets for fast filtering
	static fluidItems = new Set(
		this.items.filter((i) => i.IsFluid).map((i) => i.ID),
	);
	static buildableItems = new Set(
		this.items.filter((i) => i.CanBuild).map((i) => i.ID),
	);
	static entityItems = new Set(
		this.items.filter((i) => i.IsEntity).map((i) => i.ID),
	);

	// Recipes involving specific item types
	static fluidRecipes = new Set(
		this.recipes
			.filter(
				(r) =>
					r.Items.some((i) => this.fluidItems.has(i)) ||
					r.Results.some((i) => this.fluidItems.has(i)),
			)
			.map((r) => r.ID),
	);

	static buildableRecipes = new Set(
		this.recipes
			.filter(
				(r) =>
					r.Items.some((i) => this.buildableItems.has(i)) ||
					r.Results.some((i) => this.buildableItems.has(i)),
			)
			.map((r) => r.ID),
	);

	static entityRecipes = new Set(
		this.recipes
			.filter((r) => r.Results.some((i) => this.entityItems.has(i)))
			.map((r) => r.ID),
	);

	// Relationship mappings for recipe calculations
	static producedVia: Record<number, Recipe[]> = this.recipes.reduce(
		(acc, recipe) => {
			recipe.Results.forEach((itemId) => {
				if (acc[itemId] === undefined) acc[itemId] = [];
				acc[itemId].push(recipe);
			});
			return acc;
		},
		{} as Record<number, Recipe[]>,
	);

	static relatedRecipes: Record<number, Set<number>> = this.recipes.reduce(
		(acc, recipe) => {
			recipe.Items.forEach((itemId) => {
				if (acc[itemId] === undefined) acc[itemId] = new Set();
				acc[itemId].add(recipe.ID);
			});
			recipe.Results.forEach((itemId) => {
				if (acc[itemId] === undefined) acc[itemId] = new Set();
				acc[itemId].add(recipe.ID);
			});
			return acc;
		},
		{} as Record<number, Set<number>>,
	);

	static canBeExtracted: Record<number, number> = this.themes.reduce(
		(acc, theme) => {
			theme.GasItems.forEach((itemId, index) => {
				acc[itemId] = Math.max(theme.GasSpeeds[index], acc[itemId] ?? 0);
			});
			acc[theme.WaterItemId] = 1;
			return acc;
		},
		{} as Record<number, number>,
	);

	static canBeMined: Record<number, number> = this.veins.reduce(
		(acc, vein) => {
			acc[vein.MiningItem] = vein.MiningTime;
			return acc;
		},
		{} as Record<number, number>,
	);

	static alternativeRecipes: Record<number, number[]> = Object.entries(
		this.producedVia,
	).reduce(
		(acc, [itemId, recipes]) => {
			const id = Number(itemId);
			acc[id] = recipes
				.sort((a, b) => a.Items.length - b.Items.length)
				.map((r) => r.ID);
			return acc;
		},
		{} as Record<number, number[]>,
	);

	// Helper methods
	static getItemById(id: number): Item | undefined {
		return DSPData.itemsById[id];
	}

	static getRecipeById(id: number): Recipe | undefined {
		return DSPData.recipesById[id];
	}

	static getTechById(id: number): Tech | undefined {
		return DSPData.techsById[id];
	}

	static getThemeById(id: number): Theme | undefined {
		return DSPData.themesById[id];
	}

	static getVeinById(id: number): Vein | undefined {
		return DSPData.veinsById[id];
	}

	static getRecipesProducing(itemId: number): Recipe[] {
		return DSPData.producedVia[itemId] ?? [];
	}

	static getAlternativeRecipes(itemId: number): number[] {
		return DSPData.alternativeRecipes[itemId] ?? [];
	}

	static isFluid(itemId: number): boolean {
		return DSPData.fluidItems.has(itemId);
	}

	static isBuildable(itemId: number): boolean {
		return DSPData.buildableItems.has(itemId);
	}

	static isEntity(itemId: number): boolean {
		return DSPData.entityItems.has(itemId);
	}

	static canItemBeMined(itemId: number): boolean {
		return itemId in DSPData.canBeMined;
	}

	static canItemBeExtracted(itemId: number): boolean {
		return itemId in DSPData.canBeExtracted;
	}

	static getMiningTime(itemId: number): number | undefined {
		return DSPData.canBeMined[itemId];
	}

	static getExtractionSpeed(itemId: number): number | undefined {
		return DSPData.canBeExtracted[itemId];
	}
}
