import type React from "react";

const getIconPath = (name: string) =>
	`/assets/images/Icon_${name.replace(/ /g, "_")}.png`;

function onImgError(e: React.SyntheticEvent<HTMLImageElement>) {
	const img = e.target as HTMLImageElement;
	if (!img.dataset.retried) {
		img.dataset.retried = "1";
		const src = img.src;
		img.src = "";
		img.src = src;
	}
}

export function GameIcon({ name, size }: { name: string; size: number }) {
	return (
		<div
			className="flex-shrink-0 flex items-center justify-center"
			style={{ width: size, height: size }}
		>
			<img
				src={getIconPath(name)}
				alt={name}
				className="max-w-full max-h-full object-contain"
				onError={onImgError}
			/>
		</div>
	);
}
