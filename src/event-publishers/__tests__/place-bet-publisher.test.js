import Chance from "chance";
import PlaceBetPublisher from "../place-bet-publisher";

const chance = new Chance();

describe("placeBetPublisher", () => {
    /**
     * @type {PlaceBetPublisher}
     */
    let publisher;

    beforeEach(() => {
        publisher = new PlaceBetPublisher();

        publisher.publishToUser = jest.fn();
    });

    describe("publishMineResult", () => {
        const playerId = chance.guid();
        const payload = {
            multiplier: chance.floating({ min: 1, max: 10 }),
            winAmount: chance.natural({ min: 1, max: 1000 }),
            reachMaxWin: chance.bool(),
        };

        it("should call publishToUser", () => {
            // Act
            publisher.publishMineResult(playerId, payload);

            // Assert
            expect(publisher.publishToUser).toHaveBeenCalledWith(playerId, payload);
        });

        it("should handle mine result with zero multiplier", () => {
            // Arrange
            const zeroMultiplierPayload = {
                multiplier: 0,
                winAmount: 0,
                reachMaxWin: false,
            };

            // Act
            publisher.publishMineResult(playerId, zeroMultiplierPayload);

            // Assert
            expect(publisher.publishToUser).toHaveBeenCalledWith(playerId, zeroMultiplierPayload);
        });

        it("should handle mine result with max win reached", () => {
            // Arrange
            const maxWinPayload = {
                multiplier: 5.0,
                winAmount: 1000,
                reachMaxWin: true,
            };

            // Act
            publisher.publishMineResult(playerId, maxWinPayload);

            // Assert
            expect(publisher.publishToUser).toHaveBeenCalledWith(playerId, maxWinPayload);
        });
    });

    describe("publishSuccessBet", () => {
        const playerId = chance.guid();
        const payload = {
            multiplier: chance.floating({ min: 1, max: 10 }),
            amount: chance.natural({ min: 1, max: 1000 }),
            winAmount: chance.natural({ min: 1, max: 1000 }),
            ownChip: {
                amount: chance.natural({ min: 1, max: 1000 }),
            },
            user: {
                name: chance.name(),
            },
            roundId: chance.natural(),
        };

        it("should call publishToUser", () => {
            // Act
            publisher.publishSuccessBet(playerId, payload);

            // Assert
            expect(publisher.publishToUser).toHaveBeenCalledWith(playerId, payload);
        });

        it("should handle bet result with zero multiplier", () => {
            // Arrange
            const zeroMultiplierPayload = {
                multiplier: 0,
                amount: 100,
                winAmount: 0,
                ownChip: { amount: 100 },
                user: { name: "TestPlayer" },
                roundId: 123,
            };

            // Act
            publisher.publishSuccessBet(playerId, zeroMultiplierPayload);

            // Assert
            expect(publisher.publishToUser).toHaveBeenCalledWith(playerId, zeroMultiplierPayload);
        });

        it("should handle bet result with high multiplier", () => {
            // Arrange
            const highMultiplierPayload = {
                multiplier: 10.5,
                amount: 50,
                winAmount: 525,
                ownChip: { amount: 50 },
                user: { name: "HighRoller" },
                roundId: 456,
            };

            // Act
            publisher.publishSuccessBet(playerId, highMultiplierPayload);

            // Assert
            expect(publisher.publishToUser).toHaveBeenCalledWith(playerId, highMultiplierPayload);
        });
    });

});
