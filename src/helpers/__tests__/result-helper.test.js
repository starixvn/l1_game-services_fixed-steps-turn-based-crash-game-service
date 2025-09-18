import Chance from "chance";
import { generateRawResultForHash, generateResult } from "../result-helper";

describe.skip("resultHelper", () => {
    const chance = new Chance();

    describe("generateResult", () => {
        const hexValue = chance.hash();
        const maxHexValue = "ffffff";
        const minHaxValue = "000000";

        it.each([hexValue, maxHexValue, minHaxValue])("should return correct number", () => {
            // Act
            const result = generateResult(hexValue);

            // Assert
            expect(result).toBeGreaterThanOrEqual(1);
            expect(result).toBeLessThanOrEqual(2000);
        });
    });

    describe("generateRawResultForHash", () => {
        it("should return result at format {result}", () => {
            // Arrange
            const result = 1.23;

            // Act
            const actualResult = generateRawResultForHash(result);

            // Assert
            expect(actualResult).toBe(result);
        });
    });
});
