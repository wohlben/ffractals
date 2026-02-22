import { describe, expect, it } from "vitest";
import type { ModifierConfig } from "./models";
import {
	calculateInputRate,
	calculateOutputRate,
	calculateProliferatorConsumption,
} from "./utils";

describe("calculateInputRate", () => {
	it("should scale inputs with speed mode", () => {
		// Base rate: 10 items / (60 ticks / 60 ticks/sec) = 10 items/sec
		// With speed level 2 (1.5x multiplier): 10 * 1.5 = 15
		const result = calculateInputRate(10, 60, 1, {
			mode: "speed",
			level: 2,
		} as ModifierConfig);
		expect(result).toBe(15);
	});

	it("should reduce inputs with product mode", () => {
		// Base rate: 10 items / (60 ticks / 60 ticks/sec) = 10 items/sec
		// With product level 2 (1.2x multiplier): 10 / 1.2 = 8.33...
		const result = calculateInputRate(10, 60, 1, {
			mode: "product",
			level: 2,
		} as ModifierConfig);
		expect(result).toBeCloseTo(8.333, 3);
	});

	it("should return base rate with none mode", () => {
		const result = calculateInputRate(10, 60, 1, {
			mode: "none",
			level: 0,
		} as ModifierConfig);
		expect(result).toBe(10);
	});

	it("should apply facility speed multiplier", () => {
		// Base rate: 10 items/sec with 1.5x facility speed = 15
		const result = calculateInputRate(10, 60, 1.5, {
			mode: "none",
			level: 0,
		} as ModifierConfig);
		expect(result).toBe(15);
	});

	it("should combine facility speed and speed mode", () => {
		// Base rate: 10 * 1.5 facility speed * 1.25 speed multiplier = 18.75
		const result = calculateInputRate(10, 60, 1.5, {
			mode: "speed",
			level: 1,
		} as ModifierConfig);
		expect(result).toBe(18.75);
	});

	it("should combine facility speed and product mode correctly", () => {
		// Base rate: 10 * 1.5 facility speed / 1.25 product multiplier = 12
		const result = calculateInputRate(10, 60, 1.5, {
			mode: "product",
			level: 3,
		} as ModifierConfig);
		expect(result).toBe(12);
	});
});

describe("calculateOutputRate", () => {
	it("should calculate base output rate", () => {
		// 5 outputs / 1 sec = 5/sec
		const result = calculateOutputRate(5, 60, 1, {
			mode: "none",
			level: 0,
		} as ModifierConfig);
		expect(result).toBe(5);
	});

	it("should apply speed mode multiplier", () => {
		// 5 outputs/sec * 1.5 speed multiplier = 7.5
		const result = calculateOutputRate(5, 60, 1, {
			mode: "speed",
			level: 2,
		} as ModifierConfig);
		expect(result).toBe(7.5);
	});

	it("should apply product mode multiplier", () => {
		// 5 outputs/sec * 1.2 product multiplier = 6
		const result = calculateOutputRate(5, 60, 1, {
			mode: "product",
			level: 2,
		} as ModifierConfig);
		expect(result).toBe(6);
	});

	it("should apply facility speed multiplier", () => {
		// 5 outputs/sec * 2 facility speed = 10
		const result = calculateOutputRate(5, 60, 2, {
			mode: "none",
			level: 0,
		} as ModifierConfig);
		expect(result).toBe(10);
	});
});

describe("calculateProliferatorConsumption", () => {
	it("should return null when mode is none", () => {
		const result = calculateProliferatorConsumption(
			[{ itemId: 1001, count: 2 }],
			60,
			1,
			{ mode: "none", level: 0 } as ModifierConfig,
			1,
			1141,
		);
		expect(result).toBeNull();
	});

	it("should return null when level is 0", () => {
		const result = calculateProliferatorConsumption(
			[{ itemId: 1001, count: 2 }],
			60,
			1,
			{ mode: "speed", level: 0 } as ModifierConfig,
			1,
			1141,
		);
		expect(result).toBeNull();
	});

	it("should return null when there are no inputs", () => {
		const result = calculateProliferatorConsumption(
			[],
			60,
			1,
			{ mode: "speed", level: 1 } as ModifierConfig,
			1,
			1141,
		);
		expect(result).toBeNull();
	});

	it("should calculate charges per craft correctly", () => {
		const result = calculateProliferatorConsumption(
			[
				{ itemId: 1001, count: 2 },
				{ itemId: 1002, count: 3 },
			],
			60,
			1,
			{ mode: "speed", level: 1 } as ModifierConfig,
			1,
			1141,
		);
		expect(result).not.toBeNull();
		expect(result?.chargesPerCraft).toBe(5); // 2 + 3
	});

	it("should calculate items per craft correctly for Mk.I (12 charges)", () => {
		const result = calculateProliferatorConsumption(
			[
				{ itemId: 1001, count: 2 },
				{ itemId: 1002, count: 3 },
			],
			60,
			1,
			{ mode: "speed", level: 1 } as ModifierConfig,
			1,
			1141,
		);
		expect(result).not.toBeNull();
		expect(result?.itemsPerCraft).toBe(5 / 12);
		expect(result?.chargesPerCraft).toBe(5);
	});

	it("should calculate items per craft correctly for Mk.II (24 charges)", () => {
		const result = calculateProliferatorConsumption(
			[
				{ itemId: 1001, count: 2 },
				{ itemId: 1002, count: 3 },
			],
			60,
			1,
			{ mode: "speed", level: 2 } as ModifierConfig,
			1,
			1142,
		);
		expect(result).not.toBeNull();
		expect(result?.itemsPerCraft).toBe(5 / 24);
		expect(result?.chargesPerCraft).toBe(5);
	});

	it("should calculate items per craft correctly for Mk.III (60 charges)", () => {
		const result = calculateProliferatorConsumption(
			[
				{ itemId: 1001, count: 2 },
				{ itemId: 1002, count: 3 },
			],
			60,
			1,
			{ mode: "speed", level: 3 } as ModifierConfig,
			1,
			1143,
		);
		expect(result).not.toBeNull();
		expect(result?.itemsPerCraft).toBe(5 / 60);
		expect(result?.chargesPerCraft).toBe(5);
	});

	it("should scale with multiple facilities", () => {
		// 5 charges/craft, 1 craft/sec per facility, 3 facilities = 15 charges/sec
		// 15 charges/sec / 12 charges/item = 1.25 items/sec
		const result = calculateProliferatorConsumption(
			[
				{ itemId: 1001, count: 2 },
				{ itemId: 1002, count: 3 },
			],
			60,
			1,
			{ mode: "speed", level: 1 } as ModifierConfig,
			3,
			1141,
		);
		expect(result).not.toBeNull();
		expect(result?.chargesPerSecond).toBe(15);
		expect(result?.itemsPerSecond).toBe(1.25);
	});

	it("should scale with facility speed", () => {
		// 5 charges/craft, 2 crafts/sec per facility (2x speed), 1 facility = 10 charges/sec
		const result = calculateProliferatorConsumption(
			[
				{ itemId: 1001, count: 2 },
				{ itemId: 1002, count: 3 },
			],
			60,
			2,
			{ mode: "speed", level: 1 } as ModifierConfig,
			1,
			1141,
		);
		expect(result).not.toBeNull();
		expect(result?.chargesPerSecond).toBe(10);
		expect(result?.itemsPerSecond).toBeCloseTo(0.833, 3);
	});
});
