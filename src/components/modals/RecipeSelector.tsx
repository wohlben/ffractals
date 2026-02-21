import { useCalculator } from "@/hooks/use-calculator";
import type { RecipeSource } from "@/lib/calculator/models";
import { DSPData } from "@/lib/data/dsp-data";

interface RecipeSelectorProps {
	elementId: string | null;
	onClose: () => void;
}

export function RecipeSelector({ elementId, onClose }: RecipeSelectorProps) {
	const {
		elements,
		setElementRecipe,
		setElementToMining,
		setElementToExtraction,
	} = useCalculator();
	const element = elementId ? elements[elementId] : null;

	if (!element) return null;

	const itemId = element.itemId;
	const availableRecipes = DSPData.getRecipesProducing(itemId);
	const canMine = DSPData.canItemBeMined(itemId);
	const canExtract = DSPData.canItemBeExtracted(itemId);
	const item = DSPData.getItemById(itemId);

	const getIconPath = (itemName: string) => {
		return `/assets/images/Icon_${itemName.replace(/ /g, "_")}.png`;
	};

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
			<div className="bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
				<div className="p-4 border-b border-gray-700 flex items-center gap-3">
					{item && (
						<img
							src={getIconPath(item.Name)}
							alt={item.Name}
							width={32}
							height={32}
							className="object-contain"
						/>
					)}
					<h2 className="text-lg font-semibold text-gray-100">
						Select Source for {item?.Name}
					</h2>
					<button
						type="button"
						className="ml-auto text-gray-400 hover:text-gray-200"
						onClick={onClose}
					>
						✕
					</button>
				</div>

				<div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
					{availableRecipes.length > 0 && (
						<div>
							<h3 className="text-sm font-medium text-gray-300 mb-2">
								Recipes
							</h3>
							<div className="space-y-2">
								{availableRecipes.map((recipe) => {
									const isSelected =
										element.source?.type === "recipe" &&
										(element.source as RecipeSource).recipeId === recipe.ID;

									return (
										<div
											key={recipe.ID}
											className={`flex rounded-lg border overflow-hidden ${
												isSelected
													? "border-blue-500 bg-blue-500/10"
													: "border-gray-700"
											}`}
										>
											<button
												type="button"
												onClick={() => {
													setElementRecipe(elementId!, recipe.ID, false);
													onClose();
												}}
												className="flex-1 flex items-center gap-3 p-3 text-left hover:bg-gray-800 transition-colors"
											>
												<img
													src={getIconPath(recipe.Name)}
													alt={recipe.Name}
													width={40}
													height={40}
													className="object-contain"
												/>
												<div className="flex-1 min-w-0">
													<div className="font-medium text-gray-100">
														{recipe.Name}
													</div>
													<div className="text-sm text-gray-400">
														{recipe.TimeSpend / 60}s | Inputs:{" "}
														{recipe.Items.map((id, i) => (
															<span key={id} className="ml-1">
																{recipe.ItemCounts[i]}×{" "}
																{DSPData.getItemById(id)?.Name}
															</span>
														))}
													</div>
												</div>
											</button>
											<button
												type="button"
												onClick={() => {
													setElementRecipe(elementId!, recipe.ID, true);
													onClose();
												}}
												className="px-3 py-3 border-l border-gray-700 hover:bg-gray-800 transition-colors flex flex-col items-center justify-center min-w-[60px]"
												title="Build from scratch - auto-expand entire production chain"
											>
												<span className="text-lg">🌳</span>
												<span className="text-xs text-gray-400 mt-1">Full</span>
											</button>
										</div>
									);
								})}
							</div>
						</div>
					)}

					{canMine && (
						<button
							type="button"
							onClick={() => {
								setElementToMining(elementId!);
								onClose();
							}}
							className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
								element.source?.type === "mining"
									? "border-green-500 bg-green-500/10"
									: "border-gray-700 hover:border-gray-500"
							}`}
						>
							<div className="w-10 h-10 rounded bg-green-900/50 flex items-center justify-center text-green-400">
								⛏️
							</div>
							<div>
								<div className="font-medium text-gray-100">Mining</div>
								<div className="text-sm text-gray-400">
									Extract from ore veins
								</div>
							</div>
						</button>
					)}

					{canExtract && (
						<button
							type="button"
							onClick={() => {
								setElementToExtraction(elementId!);
								onClose();
							}}
							className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
								element.source?.type === "extraction"
									? "border-blue-500 bg-blue-500/10"
									: "border-gray-700 hover:border-gray-500"
							}`}
						>
							<div className="w-10 h-10 rounded bg-blue-900/50 flex items-center justify-center text-blue-400">
								🪐
							</div>
							<div>
								<div className="font-medium text-gray-100">
									Orbital Extraction
								</div>
								<div className="text-sm text-gray-400">
									Collect from gas giants
								</div>
							</div>
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
