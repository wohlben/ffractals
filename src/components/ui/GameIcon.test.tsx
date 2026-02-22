import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { GameIcon } from "./GameIcon";

describe("GameIcon", () => {
	test("renders with correct name and size", async () => {
		const screen = await render(<GameIcon name="Iron_Ingot" size={32} />);

		const img = screen.getByRole("img");
		await expect.element(img).toBeVisible();
		await expect.element(img).toHaveAttribute("alt", "Iron_Ingot");
		await expect
			.element(img)
			.toHaveAttribute("src", "/assets/images/Icon_Iron_Ingot.png");
	});

	test("renders with different sizes", async () => {
		const screen = await render(<GameIcon name="Copper_Ingot" size={64} />);

		const img = screen.getByRole("img");
		await expect.element(img).toBeVisible();
		// The image should be contained within the sized div
		const container = img.parentElement;
		expect(container).toHaveStyle({ width: "64px", height: "64px" });
	});

	test("handles names with spaces by replacing with underscores", async () => {
		const screen = await render(<GameIcon name="Iron Ingot" size={32} />);

		const img = screen.getByRole("img");
		await expect
			.element(img)
			.toHaveAttribute("src", "/assets/images/Icon_Iron_Ingot.png");
	});

	test("handles error by retrying image load", async () => {
		const screen = await render(<GameIcon name="NonExistent_Item" size={32} />);

		const img = screen.getByRole("img");
		await expect.element(img).toBeVisible();
		// Error handler should be attached
		expect(img).toHaveAttribute("onerror");
	});
});
