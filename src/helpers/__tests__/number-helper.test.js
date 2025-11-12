import { roundFloat, roundMultiplier, roundSubtract } from "../number-helper";

describe("number-helper", () => {
    describe("roundFloat", () => {
        it("should round to 2 decimal places by default", () => {
            expect(roundFloat(1.234)).toBe(1.23);
            expect(roundFloat(1.235)).toBe(1.24);
            expect(roundFloat(1.236)).toBe(1.24);
        });

        it("should round to specified decimal places", () => {
            expect(roundFloat(1.2345, 3)).toBe(1.235);
            expect(roundFloat(1.2345, 1)).toBe(1.2);
            expect(roundFloat(1.2345, 0)).toBe(1);
        });

        it("should handle zero", () => {
            expect(roundFloat(0)).toBe(0);
            expect(roundFloat(0, 3)).toBe(0);
        });

        it("should handle negative numbers", () => {
            expect(roundFloat(-1.234)).toBe(-1.23);
            expect(roundFloat(-1.235)).toBe(-1.24);
        });

        it("should handle string numbers", () => {
            expect(roundFloat("1.234")).toBe(1.23);
            expect(roundFloat("1.235")).toBe(1.24);
        });

        it("should handle large numbers", () => {
            expect(roundFloat(1234.567)).toBe(1234.57);
            expect(roundFloat(1234.564)).toBe(1234.56);
        });

        it("should handle numbers with trailing zeros", () => {
            expect(roundFloat(1.2)).toBe(1.2);
            expect(roundFloat(1.20)).toBe(1.2);
        });
    });

    describe("roundMultiplier", () => {
        it("should multiply and round to 2 decimal places by default", () => {
            expect(roundMultiplier(1.5, 2.3)).toBe(3.45);
            expect(roundMultiplier(1.234, 2.567)).toBe(3.17);
        });

        it("should multiply and round to specified decimal places", () => {
            expect(roundMultiplier(1.234, 2.567, 3)).toBe(3.168);
            expect(roundMultiplier(1.234, 2.567, 1)).toBe(3.2);
        });

        it("should handle zero", () => {
            expect(roundMultiplier(0, 5)).toBe(0);
            expect(roundMultiplier(5, 0)).toBe(0);
        });

        it("should handle negative numbers", () => {
            expect(roundMultiplier(-1.5, 2.3)).toBe(-3.45);
            expect(roundMultiplier(1.5, -2.3)).toBe(-3.45);
            expect(roundMultiplier(-1.5, -2.3)).toBe(3.45);
        });

        it("should handle string numbers", () => {
            expect(roundMultiplier("1.5", "2.3")).toBe(3.45);
        });

        it("should handle decimal precision correctly", () => {
            expect(roundMultiplier(0.1, 0.2)).toBe(0.02);
            expect(roundMultiplier(0.01, 0.02)).toBe(0);
        });

        it("should handle large numbers", () => {
            expect(roundMultiplier(100, 2.345)).toBe(234.5);
            expect(roundMultiplier(1000, 1.234)).toBe(1234);
        });
    });

    describe("roundSubtract", () => {
        it("should subtract and round to 2 decimal places by default", () => {
            expect(roundSubtract(5.5, 2.3)).toBe(3.2);
            expect(roundSubtract(10.234, 2.567)).toBe(7.67);
        });

        it("should subtract and round to specified decimal places", () => {
            expect(roundSubtract(10.234, 2.567, 3)).toBe(7.667);
            expect(roundSubtract(10.234, 2.567, 1)).toBe(7.7);
        });

        it("should handle zero", () => {
            expect(roundSubtract(5, 0)).toBe(5);
            expect(roundSubtract(0, 5)).toBe(-5);
        });

        it("should handle negative results", () => {
            expect(roundSubtract(2.3, 5.5)).toBe(-3.2);
            expect(roundSubtract(1, 2)).toBe(-1);
        });

        it("should handle string numbers", () => {
            expect(roundSubtract("5.5", "2.3")).toBe(3.2);
        });

        it("should handle decimal precision correctly", () => {
            expect(roundSubtract(0.3, 0.1)).toBe(0.2);
            expect(roundSubtract(0.03, 0.01)).toBe(0.02);
        });

        it("should handle large numbers", () => {
            expect(roundSubtract(1000, 234.5)).toBe(765.5);
            expect(roundSubtract(10000, 1234.56)).toBe(8765.44);
        });

        it("should handle equal numbers", () => {
            expect(roundSubtract(5.5, 5.5)).toBe(0);
            expect(roundSubtract(10, 10)).toBe(0);
        });
    });
});

