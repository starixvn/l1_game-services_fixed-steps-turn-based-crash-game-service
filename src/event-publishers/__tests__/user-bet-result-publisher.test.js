import { logger } from "sc-common";
import GameData from "../../game-data";
import UserBetResultPublisher from "../user-bet-result-publisher";
import Chance from "chance";

jest.mock("sc-game-base/src/core/helpers", () => ({
    init: jest.fn(),
    post: jest.fn(),
}));

jest.mock("sc-common", () => ({
    logger: {
        logError: jest.fn(),
    },
}));

const gameData = new GameData();
const gameName = "game";
const chance = new Chance();

describe.skip("userBetResultPublisher", () => {
    const userId = chance.guid();
    let publisher;

    beforeEach(() => {
        publisher = new UserBetResultPublisher(gameName, gameData, logger);
        publisher.publishToUser = jest.fn();
    });
    describe("publish", () => {
        beforeEach(() => {
            publisher.getBetResultStatus = jest.fn();
        });

        it("should publish to user", async () => {
            // Arrange
            const status = { win: true };
            publisher.getBetResultStatus.mockReturnValueOnce(status);

            // Act
            await publisher.publish(userId, { totalWin: 200 });

            // Assert
            expect(publisher.publishToUser).toHaveBeenCalledWith(userId, { status });
        });
    });

    describe("getBetResultStatus", () => {
        describe("when totalWin > 0", () => {
            it("should return win status", () => {
                // Arrange
                const betResult = { totalWin: chance.floating({ min: 1 }), reachMaxWin: chance.bool() };

                // Act
                const actualResult = publisher.getBetResultStatus(betResult);

                // Assert
                expect(actualResult).toStrictEqual({ win: true, bet: betResult.totalWin, reachMaxWin: betResult.reachMaxWin });
            });
        });

        describe("when totalWin <=0", () => {
            it("should return lose status", () => {
                // Arrange
                const betResult = { totalWin: 0, totalLost: chance.natural() };

                // Act
                const actualResult = publisher.getBetResultStatus(betResult);

                // Assert
                expect(actualResult).toStrictEqual({ win: false, bet: betResult.totalLost });
            });
        });
    });
});
