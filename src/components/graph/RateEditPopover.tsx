import { useEffect, useRef, useState } from "react";

interface RateEditPopoverProps {
	currentRate: number;
	onConfirm: (newRate: number) => void;
	onClose: () => void;
}

export function RateEditPopover({
	currentRate,
	onConfirm,
	onClose,
}: RateEditPopoverProps) {
	const [value, setValue] = useState(
		currentRate > 0 ? currentRate.toFixed(4) : "",
	);
	const inputRef = useRef<HTMLInputElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		inputRef.current?.select();
	}, []);

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
		const num = Number.parseFloat(value);
		if (num > 0 && Number.isFinite(num)) {
			onConfirm(num);
		}
	}

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: Required for React Flow event handling
		<div
			ref={containerRef}
			role="presentation"
			className="nopan nodrag nowheel absolute z-50 bg-gray-900 border border-gray-600 rounded-lg p-2 shadow-xl"
			style={{ top: "100%", left: 0, minWidth: 180 }}
			onClick={(e) => e.stopPropagation()}
			onMouseDown={(e) => e.stopPropagation()}
		>
			<div className="text-xs text-gray-400 mb-1">Rate (items/s)</div>
			<div className="flex gap-1">
				<input
					ref={inputRef}
					type="number"
					value={value}
					onChange={(e) => setValue(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") handleSubmit();
					}}
					min={0}
					step="any"
					className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 w-24"
				/>
				<button
					type="button"
					onClick={handleSubmit}
					className="px-2 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-500"
				>
					Set
				</button>
			</div>
		</div>
	);
}
