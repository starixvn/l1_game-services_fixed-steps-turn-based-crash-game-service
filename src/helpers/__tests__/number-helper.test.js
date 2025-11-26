import { roundFloat } from "../number-helper";

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
            expect(roundFloat(1.2)).toBe(1.2);
        });
    });
});
