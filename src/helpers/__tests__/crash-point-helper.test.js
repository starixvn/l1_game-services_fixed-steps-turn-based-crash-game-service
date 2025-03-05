import { findStage, calculateIncrement, calculateNextTapMultiplier } from "../crash-point-helper";

describe("crash-point-helper", () => {
    const mockStageConfigs = {
        initialMultiplier: 1.2,
        stages: [
            { minMultiplier: 1.0, maxMultiplier: 2.0, increment: 0.1 },
            { minMultiplier: 2.0, maxMultiplier: 5.0, increment: 0.2 },
            { minMultiplier: 5.0, maxMultiplier: 10.0, increment: 0.5 },
        ],
    };

    describe("findStage", () => {
        it("should find correct stage for given multiplier", () => {
            const stages = mockStageConfigs.stages;
            const multiplier1 = 1.5;
            const multiplier2 = 3.0;
            const multiplier3 = 7.0;

            const result1 = findStage(multiplier1, stages);
            const result2 = findStage(multiplier2, stages);
            const result3 = findStage(multiplier3, stages);

            expect(result1).toEqual(stages[0]);
            expect(result2).toEqual(stages[1]);
            expect(result3).toEqual(stages[2]);
        });

        it("should return undefined for multiplier outside stages range", () => {
            const stages = mockStageConfigs.stages;
            const multiplier1 = 0.5;
            const multiplier2 = 11.0;

            const result1 = findStage(multiplier1, stages);
            const result2 = findStage(multiplier2, stages);

            expect(result1).toBeUndefined();
            expect(result2).toBeUndefined();
        });
    });

    describe("calculateIncrement", () => {
        it("should return correct increment for given multiplier", () => {
            const multiplier1 = 1.5;
            const multiplier2 = 3.0;
            const multiplier3 = 7.0;

            const result1 = calculateIncrement(multiplier1, mockStageConfigs);
            const result2 = calculateIncrement(multiplier2, mockStageConfigs);
            const result3 = calculateIncrement(multiplier3, mockStageConfigs);

            expect(result1).toBe(0.1);
            expect(result2).toBe(0.2);
            expect(result3).toBe(0.5);
        });

        it("should return last stage increment for multiplier above max range", () => {
            const multiplier = 11.0;

            const result = calculateIncrement(multiplier, mockStageConfigs);

            expect(result).toBe(0.5);
        });

        it("should return 0 when stages array is empty", () => {
            const emptyStageConfig = { stages: [] };
            const multiplier = 1.5;

            const result = calculateIncrement(multiplier, emptyStageConfig);

            expect(result).toBe(0);
        });
    });

    describe("calculateNextTapMultiplier", () => {
        it("should calculate next multiplier within stage limits", () => {
            const currentMultiplier1 = 1.5;
            const currentMultiplier2 = 3.0;
            const currentMultiplier3 = 7.0;

            const result1 = calculateNextTapMultiplier(currentMultiplier1, mockStageConfigs);
            const result2 = calculateNextTapMultiplier(currentMultiplier2, mockStageConfigs);
            const result3 = calculateNextTapMultiplier(currentMultiplier3, mockStageConfigs);

            expect(result1).toBe(1.6);
            expect(result2).toBe(3.2);
            expect(result3).toBe(7.5);
        });

        it("should not exceed stage max multiplier", () => {
            const currentMultiplier1 = 1.95;
            const currentMultiplier2 = 4.9;
            const currentMultiplier3 = 9.8;

            const result1 = calculateNextTapMultiplier(currentMultiplier1, mockStageConfigs);
            const result2 = calculateNextTapMultiplier(currentMultiplier2, mockStageConfigs);
            const result3 = calculateNextTapMultiplier(currentMultiplier3, mockStageConfigs);

            expect(result1).toBe(2.0);
            expect(result2).toBe(5.0);
            expect(result3).toBe(10.0);
        });

        it("should handle multiplier outside stages range", () => {
            const currentMultiplier = 11.0;

            const result = calculateNextTapMultiplier(currentMultiplier, mockStageConfigs);

            expect(result).toBe(11.5);
        });
    });
});
