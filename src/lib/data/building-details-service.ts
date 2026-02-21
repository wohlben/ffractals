import buildingDetailsData from "../../assets/building-details.json";

interface BuildingDetails {
	name: string;
	category: string;
	description: string;
	stats: Record<string, string>;
	wikiUrl: string;
	imageName: string;
}

interface BuildingDetailsData {
	scraped_at: string;
	total_buildings: number;
	successful: number;
	failed: number;
	buildings: BuildingDetails[];
}

export class BuildingDetailsService {
	private static data: BuildingDetailsData =
		buildingDetailsData as unknown as BuildingDetailsData;

	// Map of building names to item IDs (from ItemProtoSet)
	private static buildingNameToItemId: Record<string, number> = {
		"Arc Smelter": 2302,
		"Plane Smelter": 2315,
		"Negentropy Smelter": 2319,
		"Assembling Machine Mk.I": 2303,
		"Assembling Machine Mk.II": 2304,
		"Assembling Machine Mk.III": 2305,
		"Re-composing Assembler": 2318,
		"Matrix Lab": 2901,
		"Self-evolution Lab": 2902,
		"Chemical Plant": 2309,
		"Quantum Chemical Plant": 2317,
		"Oil Refinery": 2308,
		"Miniature Particle Collider": 2310,
		Fractionator: 2314,
	};

	// Map recipe types to their facility categories
	private static recipeTypeCategories: Record<string, string[]> = {
		Smelt: ["Smelting Facility"],
		Assemble: ["Assembler"],
		Research: ["Research Facility"],
		Chemical: ["Chemical Facility"],
		Refine: ["Refining Facility"],
		Particle: ["Particle Collider"],
		Fractionate: ["Fractionation Facility"],
	};

	/**
	 * Get speed multiplier for a facility by item ID
	 */
	static getSpeedMultiplier(itemId: number): number | undefined {
		// Find building by item ID
		const buildingName = Object.entries(
			BuildingDetailsService.buildingNameToItemId,
		).find(([, id]) => id === itemId)?.[0];

		if (!buildingName) {
			return undefined;
		}

		const building = BuildingDetailsService.data.buildings.find(
			(b) => b.name === buildingName,
		);
		if (!building) {
			return undefined;
		}

		// Parse production speed from stats
		const productionSpeed = building.stats["Production Speed"];
		if (productionSpeed) {
			const match = productionSpeed.match(/([\d.]+)x/);
			if (match) {
				return parseFloat(match[1]);
			}
		}

		return undefined;
	}

	/**
	 * Get all facilities for a recipe type with their speed multipliers
	 */
	static getFacilitiesForRecipeType(
		recipeType: string,
	): Array<{ itemId: number; name: string; speedMultiplier: number }> {
		const categories = BuildingDetailsService.recipeTypeCategories[recipeType];
		if (!categories) {
			return [];
		}

		const facilities: Array<{
			itemId: number;
			name: string;
			speedMultiplier: number;
		}> = [];

		for (const [buildingName, itemId] of Object.entries(
			BuildingDetailsService.buildingNameToItemId,
		)) {
			const building = BuildingDetailsService.data.buildings.find(
				(b) => b.name === buildingName,
			);
			if (building && categories.includes(building.category)) {
				const speed = BuildingDetailsService.getSpeedMultiplier(itemId);
				if (speed !== undefined) {
					facilities.push({
						itemId,
						name: buildingName,
						speedMultiplier: speed,
					});
				}
			}
		}

		// Sort by speed multiplier
		return facilities.sort((a, b) => a.speedMultiplier - b.speedMultiplier);
	}

	/**
	 * Get default facility for a recipe type (lowest tier)
	 */
	static getDefaultFacilityForRecipeType(
		recipeType: string,
	): number | undefined {
		const facilities =
			BuildingDetailsService.getFacilitiesForRecipeType(recipeType);
		return facilities.length > 0 ? facilities[0].itemId : undefined;
	}

	/**
	 * Get building details by item ID
	 */
	static getBuildingByItemId(itemId: number): BuildingDetails | undefined {
		const buildingName = Object.entries(
			BuildingDetailsService.buildingNameToItemId,
		).find(([, id]) => id === itemId)?.[0];

		if (!buildingName) {
			return undefined;
		}

		return BuildingDetailsService.data.buildings.find(
			(b) => b.name === buildingName,
		);
	}

	/**
	 * Get all available recipe types that have facilities
	 */
	static getSupportedRecipeTypes(): string[] {
		return Object.keys(BuildingDetailsService.recipeTypeCategories);
	}
}
