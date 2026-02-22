import { beforeEach, describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { FacilityEditPopover } from "./FacilityEditPopover";

// Mock the BuildingDetailsService
vi.mock("@/lib/data/building-details-service", () => ({
	BuildingDetailsService: {
		getFacilitiesForRecipeType: vi.fn((recipeType: string) => {
			if (recipeType === "Smelt") {
				return [
					{ itemId: 2301, name: "Smelter", speedMultiplier: 1 },
					{ itemId: 2302, name: "Arc_Smelter", speedMultiplier: 2 },
					{ itemId: 2303, name: "Plane_Smelter", speedMultiplier: 3 },
				];
			}
			if (recipeType === "Assemble") {
				return [
					{ itemId: 2304, name: "Assembling_Machine_Mk.I", speedMultiplier: 1 },
					{
						itemId: 2305,
						name: "Assembling_Machine_Mk.II",
						speedMultiplier: 1.5,
					},
				];
			}
			return [];
		}),
	},
}));

describe("FacilityEditPopover", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("renders facility options for recipe type", async () => {
		const screen = await render(
			<FacilityEditPopover
				recipeType="Smelt"
				currentFacilityItemId={2301}
				currentCount={1}
				isRoot={false}
				onConfirm={vi.fn()}
				onClose={vi.fn()}
			/>,
		);

		await expect.element(screen.getByText("Facility type")).toBeVisible();

		// Should show all facilities for Smelt type
		const buttons = screen.getAllByRole("button");
		expect(buttons.length).toBeGreaterThanOrEqual(3); // 3 facilities + Set button
	});

	test("shows selected facility with highlight", async () => {
		const screen = await render(
			<FacilityEditPopover
				recipeType="Smelt"
				currentFacilityItemId={2302}
				currentCount={1}
				isRoot={false}
				onConfirm={vi.fn()}
				onClose={vi.fn()}
			/>,
		);

		// Find the button for Arc_Smelter (itemId 2302) - should have selected styling
		const buttons = await screen.getAllByRole("button");
		// The Set button is the last one, facility buttons are first
		const facilityButtons = buttons.slice(0, -1);

		// Check that one of them has the selected class
		let foundSelected = false;
		for (const button of facilityButtons) {
			const classAttr = await button.getAttribute("class");
			if (classAttr?.includes("border-blue-500")) {
				foundSelected = true;
				break;
			}
		}
		expect(foundSelected).toBe(true);
	});

	test("allows selecting different facility", async () => {
		const onConfirm = vi.fn();
		const screen = await render(
			<FacilityEditPopover
				recipeType="Smelt"
				currentFacilityItemId={2301}
				currentCount={1}
				isRoot={false}
				onConfirm={onConfirm}
				onClose={vi.fn()}
			/>,
		);

		// Click on the second facility button
		const buttons = await screen.getAllByRole("button");
		const facilityButtons = buttons.slice(0, -1);
		await facilityButtons[1].click();

		// Click Set button
		await buttons[buttons.length - 1].click();

		expect(onConfirm).toHaveBeenCalledWith(2302, undefined);
	});

	test("shows count input for root nodes", async () => {
		const screen = await render(
			<FacilityEditPopover
				recipeType="Smelt"
				currentFacilityItemId={2301}
				currentCount={5}
				isRoot={true}
				onConfirm={vi.fn()}
				onClose={vi.fn()}
			/>,
		);

		await expect.element(screen.getByText("Facility count")).toBeVisible();

		const countInput = screen.getByRole("spinbutton");
		await expect.element(countInput).toHaveValue("5");
	});

	test("hides count input for non-root nodes", async () => {
		const screen = await render(
			<FacilityEditPopover
				recipeType="Smelt"
				currentFacilityItemId={2301}
				currentCount={5}
				isRoot={false}
				onConfirm={vi.fn()}
				onClose={vi.fn()}
			/>,
		);

		// Should not show "Facility count" label
		await expect(screen.queryByText("Facility count")).not.toBeInTheDocument();
		// Should not have a spinbutton
		expect(screen.queryByRole("spinbutton")).toBeNull();
	});

	test("confirms with new count for root nodes", async () => {
		const onConfirm = vi.fn();
		const screen = await render(
			<FacilityEditPopover
				recipeType="Smelt"
				currentFacilityItemId={2301}
				currentCount={1}
				isRoot={true}
				onConfirm={onConfirm}
				onClose={vi.fn()}
			/>,
		);

		// Change count
		const countInput = screen.getByRole("spinbutton");
		await countInput.fill("10");

		// Click Set button
		const buttons = await screen.getAllByRole("button");
		await buttons[buttons.length - 1].click();

		expect(onConfirm).toHaveBeenCalledWith(2301, 10);
	});

	test("does not confirm with invalid count", async () => {
		const onConfirm = vi.fn();
		const screen = await render(
			<FacilityEditPopover
				recipeType="Smelt"
				currentFacilityItemId={2301}
				currentCount={1}
				isRoot={true}
				onConfirm={onConfirm}
				onClose={vi.fn()}
			/>,
		);

		// Enter invalid count
		const countInput = screen.getByRole("spinbutton");
		await countInput.fill("-5");

		// Click Set button
		const buttons = await screen.getAllByRole("button");
		await buttons[buttons.length - 1].click();

		expect(onConfirm).not.toHaveBeenCalled();
	});

	test("closes on Escape key", async () => {
		const onClose = vi.fn();
		const screen = await render(
			<FacilityEditPopover
				recipeType="Smelt"
				currentFacilityItemId={2301}
				currentCount={1}
				isRoot={false}
				onConfirm={vi.fn()}
				onClose={onClose}
			/>,
		);

		// Press Escape on any element
		await screen.getByRole("button").press("Escape");

		expect(onClose).toHaveBeenCalled();
	});

	test("closes on click outside", async () => {
		const onClose = vi.fn();
		const screen = await render(
			<div>
				<div data-testid="outside">Outside</div>
				<FacilityEditPopover
					recipeType="Smelt"
					currentFacilityItemId={2301}
					currentCount={1}
					isRoot={false}
					onConfirm={vi.fn()}
					onClose={onClose}
				/>
			</div>,
		);

		await screen.getByTestId("outside").click();

		expect(onClose).toHaveBeenCalled();
	});

	test("returns null when no facilities available", async () => {
		const screen = await render(
			<FacilityEditPopover
				recipeType="Unknown"
				currentFacilityItemId={0}
				currentCount={1}
				isRoot={false}
				onConfirm={vi.fn()}
				onClose={vi.fn()}
			/>,
		);

		// Component should render nothing
		expect(screen.container.innerHTML).toBe("");
	});

	test("confirms on Enter key in count input", async () => {
		const onConfirm = vi.fn();
		const screen = await render(
			<FacilityEditPopover
				recipeType="Smelt"
				currentFacilityItemId={2301}
				currentCount={1}
				isRoot={true}
				onConfirm={onConfirm}
				onClose={vi.fn()}
			/>,
		);

		const countInput = screen.getByRole("spinbutton");
		await countInput.fill("8");
		await countInput.press("Enter");

		expect(onConfirm).toHaveBeenCalledWith(2301, 8);
	});
});
