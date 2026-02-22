import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import Header from "./Header";

// Mock the router Link component
vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		...props
	}: {
		children: React.ReactNode;
		to: string;
		[key: string]: unknown;
	}) => (
		<a href={to} {...props}>
			{children}
		</a>
	),
}));

describe("Header", () => {
	test("renders header with logo", async () => {
		const screen = await render(<Header />);

		// Should have a header element
		const header = screen.getByRole("banner");
		await expect.element(header).toBeVisible();

		// Should have a link to home
		const homeLink = screen.getByRole("link");
		await expect.element(homeLink).toBeVisible();
	});

	test("renders menu button", async () => {
		const screen = await render(<Header />);

		const menuButton = screen.getByRole("button", { name: "Open menu" });
		await expect.element(menuButton).toBeVisible();
	});

	test("opens sidebar when menu button is clicked", async () => {
		const screen = await render(<Header />);

		// Sidebar should be initially hidden
		expect(screen.queryByText("Navigation")).toBeNull();

		// Click menu button
		await screen.getByRole("button", { name: "Open menu" }).click();

		// Sidebar should now be visible
		await expect.element(screen.getByText("Navigation")).toBeVisible();
	});

	test("closes sidebar when close button is clicked", async () => {
		const screen = await render(<Header />);

		// Open sidebar
		await screen.getByRole("button", { name: "Open menu" }).click();
		await expect.element(screen.getByText("Navigation")).toBeVisible();

		// Click close button
		await screen.getByRole("button", { name: "Close menu" }).click();

		// Sidebar should be hidden again
		// Note: Due to animation, we check that the close button is gone
		expect(screen.queryByRole("button", { name: "Close menu" })).toBeNull();
	});

	test("closes sidebar when clicking a navigation link", async () => {
		const screen = await render(<Header />);

		// Open sidebar
		await screen.getByRole("button", { name: "Open menu" }).click();
		await expect.element(screen.getByText("Navigation")).toBeVisible();

		// Click a navigation link
		const homeLink = screen.getByRole("link", { name: /Home/i });
		await homeLink.click();

		// Close button should be gone (sidebar closed)
		expect(screen.queryByRole("button", { name: "Close menu" })).toBeNull();
	});

	test("renders navigation links", async () => {
		const screen = await render(<Header />);

		// Open sidebar
		await screen.getByRole("button", { name: "Open menu" }).click();

		// Check for navigation links
		await expect
			.element(screen.getByRole("link", { name: /Home/i }))
			.toBeVisible();
		await expect
			.element(screen.getByRole("link", { name: /Store/i }))
			.toBeVisible();
	});

	test("navigation links have correct hrefs", async () => {
		const screen = await render(<Header />);

		// Open sidebar
		await screen.getByRole("button", { name: "Open menu" }).click();

		// Check hrefs
		const homeLink = screen.getByRole("link", { name: /Home/i });
		await expect.element(homeLink).toHaveAttribute("href", "/");

		const storeLink = screen.getByRole("link", { name: /Store/i });
		await expect.element(storeLink).toHaveAttribute("href", "/demo/store");
	});
});
