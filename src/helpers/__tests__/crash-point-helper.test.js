import { calculateIncrement } from "../crash-point-helper";

describe("crash-point-helper", () => {
    const mockMultiplierConfig = {
        multiplierSteps: [
            1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0, 3.2, 3.4, 3.6, 3.8, 4.0, 4.2, 4.4, 4.6, 4.8,
            5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0,
        ],
    };

    describe("calculateIncrement", () => {
        it.each([
            [1.5, 0.1, "first stage"],
            [3.0, 0.2, "second stage"],
            [7.0, 0.5, "third stage"],
        ])("should return %f for multiplier %f in %s", (multiplier, expectedIncrement, description) => {
            const result = calculateIncrement(multiplier, mockMultiplierConfig);
            expect(result).toBeCloseTo(expectedIncrement, 5);
        });

        it("should return 0 when config is null", () => {
            const multiplier = 1.5;

            const result = calculateIncrement(multiplier, null);
            expect(result).toBe(0);
        });

        it("should return 0 when config is undefined", () => {
            const multiplier = 1.5;

            const result = calculateIncrement(multiplier, undefined);
            expect(result).toBe(0);
        });

        it.each([
            [0.1, "min of first stage", 1.0],
            [0.2, "max of first/min of second stage", 2.0],
            [0.5, "max of second/min of third stage", 5.0],
            [0, "out of max third stage", 10.0],
        ])("should return %f for %s: %f", (expectedIncrement, description, multiplier) => {
            const result = calculateIncrement(multiplier, mockMultiplierConfig);
            expect(result).toBeCloseTo(expectedIncrement, 5);
        });
    });
});
