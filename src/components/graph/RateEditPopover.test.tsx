import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { RateEditPopover } from "./RateEditPopover";

describe("RateEditPopover", () => {
	test("renders with current rate", async () => {
		const screen = await render(
			<RateEditPopover
				currentRate={5.5}
				onConfirm={vi.fn()}
				onClose={vi.fn()}
			/>,
		);

		await expect.element(screen.getByText("Rate (items/s)")).toBeVisible();

		const input = screen.getByRole("spinbutton");
		await expect.element(input).toHaveValue("5.5000");
	});

	test("renders empty input when current rate is 0", async () => {
		const screen = await render(
			<RateEditPopover currentRate={0} onConfirm={vi.fn()} onClose={vi.fn()} />,
		);

		const input = screen.getByRole("spinbutton");
		await expect.element(input).toHaveValue("");
	});

	test("allows entering new rate", async () => {
		const onConfirm = vi.fn();
		const screen = await render(
			<RateEditPopover
				currentRate={1}
				onConfirm={onConfirm}
				onClose={vi.fn()}
			/>,
		);

		const input = screen.getByRole("spinbutton");
		await input.fill("10.5");

		await screen.getByRole("button", { name: "Set" }).click();

		expect(onConfirm).toHaveBeenCalledWith(10.5);
	});

	test("confirms on Enter key", async () => {
		const onConfirm = vi.fn();
		const screen = await render(
			<RateEditPopover
				currentRate={1}
				onConfirm={onConfirm}
				onClose={vi.fn()}
			/>,
		);

		const input = screen.getByRole("spinbutton");
		await input.fill("7.5");
		await input.press("Enter");

		expect(onConfirm).toHaveBeenCalledWith(7.5);
	});

	test("does not confirm with invalid rate", async () => {
		const onConfirm = vi.fn();
		const screen = await render(
			<RateEditPopover
				currentRate={1}
				onConfirm={onConfirm}
				onClose={vi.fn()}
			/>,
		);

		const input = screen.getByRole("spinbutton");
		await input.fill("-5");

		await screen.getByRole("button", { name: "Set" }).click();

		expect(onConfirm).not.toHaveBeenCalled();
	});

	test("does not confirm with non-numeric value", async () => {
		const onConfirm = vi.fn();
		const screen = await render(
			<RateEditPopover
				currentRate={1}
				onConfirm={onConfirm}
				onClose={vi.fn()}
			/>,
		);

		const input = screen.getByRole("spinbutton");
		await input.fill("abc");

		await screen.getByRole("button", { name: "Set" }).click();

		expect(onConfirm).not.toHaveBeenCalled();
	});

	test("closes on Escape key", async () => {
		const onClose = vi.fn();
		const screen = await render(
			<RateEditPopover currentRate={1} onConfirm={vi.fn()} onClose={onClose} />,
		);

		await screen.getByRole("spinbutton").press("Escape");

		expect(onClose).toHaveBeenCalled();
	});

	test("closes on click outside", async () => {
		const onClose = vi.fn();
		const screen = await render(
			<div>
				<div data-testid="outside">Outside</div>
				<RateEditPopover
					currentRate={1}
					onConfirm={vi.fn()}
					onClose={onClose}
				/>
			</div>,
		);

		await screen.getByTestId("outside").click();

		expect(onClose).toHaveBeenCalled();
	});

	test("input has correct attributes", async () => {
		const screen = await render(
			<RateEditPopover currentRate={1} onConfirm={vi.fn()} onClose={vi.fn()} />,
		);

		const input = screen.getByRole("spinbutton");
		await expect.element(input).toHaveAttribute("min", "0");
		await expect.element(input).toHaveAttribute("step", "any");
		await expect.element(input).toHaveAttribute("type", "number");
	});
});
