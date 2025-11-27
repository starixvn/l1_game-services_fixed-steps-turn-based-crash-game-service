import { generateTapResult, getNextMultiplier } from "../crash-point-helper";

describe("crash-point-helper", () => {
    describe("generateTapResult", () => {
        it("should return true when result is greater than 1.0", () => {
            expect(generateTapResult(1.1)).toBe(true);
            expect(generateTapResult(2.0)).toBe(true);
            expect(generateTapResult(10.5)).toBe(true);
        });

        it("should return false when result is less than or equal to 1.0", () => {
            expect(generateTapResult(1.0)).toBe(false);
            expect(generateTapResult(0.5)).toBe(false);
            expect(generateTapResult(0.1)).toBe(false);
        });
    });

    describe("getNextMultiplier", () => {
        const mockMultiplierConfig = {
            mode: 1,
            multiplierSteps: [
                1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0, 3.2, 3.4, 3.6, 3.8, 4.0, 4.2, 4.4, 4.6, 4.8,
                5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0,
            ],
        };
        it.each([
            [1.5, 1.6],
            [3.0, 3.2],
            [7.0, 7.5],
        ])("should return %f when multiplier is %f", (multiplier, expectedNextMultiplier) => {
            const result = getNextMultiplier(multiplier, mockMultiplierConfig);
            expect(result).toBeCloseTo(expectedNextMultiplier, 2);
        });

        it("should return 0 when config is null", () => {
            const multiplier = 1.5;

            const result = getNextMultiplier(multiplier, null);
            expect(result).toBe(0);
        });

        it("should return 0 when config is undefined", () => {
            const multiplier = 1.5;

            const result = getNextMultiplier(multiplier, undefined);
            expect(result).toBe(0);
        });

        it("should return 0 when multiplier is not found in multiplierSteps", () => {
            const multiplier = 1.25; // This value is not in the multiplierSteps array
            const result = getNextMultiplier(multiplier, mockMultiplierConfig);
            expect(result).toBe(0);
        });

        it("should return 0 when multiplier is the last step in multiplierSteps", () => {
            const multiplier = 10.0; // This is the last value in the multiplierSteps array
            const result = getNextMultiplier(multiplier, mockMultiplierConfig);
            expect(result).toBe(0);
        });
    });
});
