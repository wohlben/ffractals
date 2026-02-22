import { useEffect, useRef, useState } from "react";
import { GameIcon } from "@/components/ui/GameIcon";
import { BuildingDetailsService } from "@/lib/data/building-details-service";

interface FacilityEditPopoverProps {
	recipeType: string;
	currentFacilityItemId: number;
	currentCount: number;
	isRoot: boolean;
	onConfirm: (facilityItemId: number, count?: number) => void;
	onClose: () => void;
}

export function FacilityEditPopover({
	recipeType,
	currentFacilityItemId,
	currentCount,
	isRoot,
	onConfirm,
	onClose,
}: FacilityEditPopoverProps) {
	const facilities =
		BuildingDetailsService.getFacilitiesForRecipeType(recipeType);
	const [selectedId, setSelectedId] = useState(currentFacilityItemId);
	const [count, setCount] = useState(
		currentCount > 0
			? Number.isInteger(currentCount)
				? String(currentCount)
				: currentCount.toFixed(2)
			: "1",
	);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				onClose();
			}
		}
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("mousedown", handleClickOutside);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [onClose]);

	function handleSubmit() {
		if (isRoot) {
			const num = Number.parseFloat(count);
			if (num > 0 && Number.isFinite(num)) {
				onConfirm(selectedId, num);
			}
		} else {
			onConfirm(selectedId);
		}
	}

	if (facilities.length === 0) return null;

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: Required for React Flow event handling
		<div
			ref={containerRef}
			role="presentation"
			className="nopan nodrag nowheel absolute z-50 bg-gray-900 border border-gray-600 rounded-lg p-2 shadow-xl"
			style={{ top: "100%", left: 0, minWidth: 200 }}
			onClick={(e) => e.stopPropagation()}
			onMouseDown={(e) => e.stopPropagation()}
		>
			<div className="text-xs text-gray-400 mb-1">Facility type</div>
			<div className="flex gap-1 mb-2">
				{facilities.map((fac) => (
					<button
						key={fac.itemId}
						type="button"
						onClick={() => setSelectedId(fac.itemId)}
						className={`p-1 rounded border ${
							selectedId === fac.itemId
								? "border-blue-500 bg-blue-900/30"
								: "border-gray-700 hover:border-gray-500"
						}`}
						title={`${fac.name} (${fac.speedMultiplier}x)`}
					>
						<GameIcon name={fac.name} size={28} />
					</button>
				))}
			</div>

			{isRoot && (
				<>
					<div className="text-xs text-gray-400 mb-1">Facility count</div>
					<input
						type="number"
						value={count}
						onChange={(e) => setCount(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleSubmit();
						}}
						min={0}
						step="any"
						className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 mb-2"
					/>
				</>
			)}

			<button
				type="button"
				onClick={handleSubmit}
				className="w-full px-2 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-500"
			>
				Set
			</button>
		</div>
	);
}
