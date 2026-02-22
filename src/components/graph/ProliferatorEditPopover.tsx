import { useEffect, useRef, useState } from "react";
import { GameIcon } from "@/components/ui/GameIcon";
import {
	PROLIFERATOR_CHARGES,
	PROLIFERATOR_PRODUCT_MULTIPLIERS,
	PROLIFERATOR_SPEED_MULTIPLIERS,
	type ProliferatorMode,
} from "@/lib/calculator/models";

interface ProliferatorEditPopoverProps {
	currentMode: ProliferatorMode;
	currentLevel: number;
	currentItemId?: number;
	recipeTime?: number;
	facilitySpeed?: number;
	inputCount?: number;
	onConfirm: (mode: ProliferatorMode, level: number, itemId: number) => void;
	onClose: () => void;
}

const MODES: { id: ProliferatorMode; label: string; description: string }[] = [
	{
		id: "none",
		label: "None",
		description: "No proliferator used",
	},
	{
		id: "speed",
		label: "Speed",
		description: "Faster production, more power",
	},
	{
		id: "product",
		label: "Product",
		description: "More output, fewer inputs needed",
	},
];

const PROLIFERATOR_ITEMS = [
	{ id: 1141, name: "Proliferator_Mk.I", level: 1 },
	{ id: 1142, name: "Proliferator_Mk.II", level: 2 },
	{ id: 1143, name: "Proliferator_Mk.III", level: 3 },
];

export function ProliferatorEditPopover({
	currentMode,
	currentLevel,
	currentItemId,
	recipeTime,
	facilitySpeed,
	inputCount,
	onConfirm,
	onClose,
}: ProliferatorEditPopoverProps) {
	const [mode, setMode] = useState<ProliferatorMode>(currentMode);
	const [level, setLevel] = useState(currentLevel);
	const [itemId, setItemId] = useState(
		currentItemId ?? PROLIFERATOR_ITEMS[0].id,
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

	const handleModeChange = (newMode: ProliferatorMode) => {
		setMode(newMode);
		if (newMode === "none") {
			setLevel(0);
		} else if (level === 0) {
			setLevel(1);
		}
	};

	const handleLevelChange = (newLevel: number) => {
		setLevel(newLevel);
		// Auto-select appropriate proliferator item based on level
		const item = PROLIFERATOR_ITEMS.find((p) => p.level === newLevel);
		if (item) {
			setItemId(item.id);
		}
	};

	const handleSubmit = () => {
		onConfirm(mode, level, itemId);
	};

	const getMultiplier = () => {
		if (mode === "none" || level === 0) return 1;
		if (mode === "speed") {
			return PROLIFERATOR_SPEED_MULTIPLIERS[level] ?? 1;
		}
		return PROLIFERATOR_PRODUCT_MULTIPLIERS[level] ?? 1;
	};

	const calculatePreview = () => {
		if (mode === "none" || level === 0 || !recipeTime || !facilitySpeed) {
			return null;
		}

		const multiplier = getMultiplier();
		const chargesPerItem = PROLIFERATOR_CHARGES[itemId] ?? 12;

		// Calculate crafts per second
		const craftsPerSecond = (60 / recipeTime) * facilitySpeed;

		// For product mode, charges per craft = total inputs
		const chargesPerCraft = inputCount ?? 1;
		const totalChargesPerSecond = chargesPerCraft * craftsPerSecond;
		const itemsPerSecond = totalChargesPerSecond / chargesPerItem;

		return {
			multiplier,
			chargesPerCraft,
			itemsPerSecond,
		};
	};

	const preview = calculatePreview();
	const multiplier = getMultiplier();

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: Required for React Flow event handling
		<div
			ref={containerRef}
			role="presentation"
			className="nopan nodrag nowheel absolute z-50 bg-gray-900 border border-gray-600 rounded-lg p-3 shadow-xl"
			style={{ top: "100%", left: 0, minWidth: 220 }}
			onClick={(e) => e.stopPropagation()}
			onMouseDown={(e) => e.stopPropagation()}
		>
			{/* Mode Selection */}
			<div className="text-xs text-gray-400 mb-2">Proliferator Mode</div>
			<div className="flex gap-1 mb-3">
				{MODES.map((m) => (
					<button
						key={m.id}
						type="button"
						onClick={() => handleModeChange(m.id)}
						className={`flex-1 px-2 py-1 text-xs rounded border ${
							mode === m.id
								? "border-blue-500 bg-blue-900/30 text-blue-300"
								: "border-gray-700 hover:border-gray-500 text-gray-400"
						}`}
						title={m.description}
					>
						{m.label}
					</button>
				))}
			</div>

			{/* Level Selection - only show if mode is not "none" */}
			{mode !== "none" && (
				<>
					<div className="text-xs text-gray-400 mb-2">
						Level ({level}) - {multiplier.toFixed(2)}x
					</div>
					<div className="flex gap-1 mb-3">
						{[1, 2, 3].map((lvl) => (
							<button
								key={lvl}
								type="button"
								onClick={() => handleLevelChange(lvl)}
								className={`flex-1 px-2 py-1 text-xs rounded border ${
									level === lvl
										? "border-blue-500 bg-blue-900/30 text-blue-300"
										: "border-gray-700 hover:border-gray-500 text-gray-400"
								}`}
							>
								Mk.{["I", "II", "III"][lvl - 1]}
							</button>
						))}
					</div>

					{/* Proliferator Item Selection */}
					<div className="text-xs text-gray-400 mb-2">Proliferator Type</div>
					<div className="flex gap-1 mb-3">
						{PROLIFERATOR_ITEMS.map((item) => (
							<button
								key={item.id}
								type="button"
								onClick={() => setItemId(item.id)}
								className={`p-1 rounded border ${
									itemId === item.id
										? "border-blue-500 bg-blue-900/30"
										: "border-gray-700 hover:border-gray-500"
								}`}
								title={item.name}
							>
								<GameIcon name={item.name} size={24} />
							</button>
						))}
					</div>

					{/* Preview */}
					{preview && (
						<div className="bg-gray-800 rounded p-2 mb-3 text-xs">
							<div className="text-gray-400 mb-1">Effect Preview</div>
							<div className="text-gray-300">
								{mode === "speed" ? (
									<>
										<span className="text-green-400">
											+{Math.round((multiplier - 1) * 100)}%
										</span>{" "}
										production speed
									</>
								) : (
									<>
										<span className="text-green-400">
											+{Math.round((multiplier - 1) * 100)}%
										</span>{" "}
										products,{" "}
										<span className="text-blue-400">
											-{Math.round((1 - 1 / multiplier) * 100)}%
										</span>{" "}
										inputs needed
									</>
								)}
							</div>
							<div className="text-gray-400 mt-1">
								Consumption: {preview.itemsPerSecond.toFixed(3)}/s
							</div>
						</div>
					)}
				</>
			)}

			<button
				type="button"
				onClick={handleSubmit}
				className="w-full px-2 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-500"
			>
				Apply
			</button>
		</div>
	);
}
