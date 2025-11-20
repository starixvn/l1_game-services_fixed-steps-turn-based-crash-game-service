import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import CrashGameData from "../../game-data";
import { SettleCashOutConsumer } from "../settle-cash-out-consumer";
import { UnsettledRoundConsumer } from "../unsettled-round-consumer";

let gameData;

/** @type {mongoose.Model}*/
const roundsRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const betLogsRepository = stubMongoose(mongoose.Model);

const settleCashOutConsumer = stub(SettleCashOutConsumer);

beforeEach(() => {
    gameData = new CrashGameData(3);
});

afterEach(() => {
    jest.clearAllMocks();
});

function initConsumer() {
    return new UnsettledRoundConsumer({
        gameData,
        roundsRepository,
        betLogsRepository,
        settleCashOutConsumer,
    });
}

describe("unsettledRoundConsumer", () => {
    describe("proceed", () => {
        describe("when there are no unsettled bets", () => {
            it("should not call settleCashOutConsumer", async () => {
                // Arrange
                const unsettledRoundConsumer = initConsumer();
                roundsRepository.find.mockReturnValue({
                    lean: jest.fn().mockReturnValue({
                        exec: jest.fn().mockResolvedValue([]),
                    }),
                });

                // Act
                await unsettledRoundConsumer.proceed();

                // Assert
                expect(settleCashOutConsumer.proceedCashOut).not.toHaveBeenCalled();
            });
        });

        describe("when there are unsettled bets", () => {
            it("should query unsettled rounds and process them", async () => {
                // Arrange
                const unsettledRounds = [
                    {
                        id: "round-1",
                        uid: "player1-uid",
                        name: "player1",
                        amount: 100,
                        multiplierMode: 2,
                    },
                ];

                const betLogs = [
                    {
                        siteId: "site-1",
                        currency: "USD",
                        operatorId: "op-1",
                        playerId: "player-1",
                        rate: 1.0,
                        currencyMultiplier: 1.0,
                        currencyCode: "USD",
                        multiplier: 2.5,
                    },
                ];

                roundsRepository.find.mockReturnValue({
                    lean: jest.fn().mockReturnValue({
                        exec: jest.fn().mockResolvedValue(unsettledRounds),
                    }),
                });

                betLogsRepository.find.mockReturnValue({
                    lean: jest.fn().mockReturnValue({
                        exec: jest.fn().mockResolvedValue(betLogs),
                    }),
                });

                settleCashOutConsumer.proceedCashOut.mockResolvedValue();

                const unsettledRoundConsumer = initConsumer();

                // Act
                await unsettledRoundConsumer.proceed();

                // Assert
                expect(roundsRepository.find).toHaveBeenCalledWith({ paid: false });
                expect(betLogsRepository.find).toHaveBeenCalledWith(
                    { roundId: "round-1" },
                    { _id: false },
                    { sort: { time: -1 } }
                );
                expect(settleCashOutConsumer.proceedCashOut).toHaveBeenCalledWith(
                    {
                        UID: "player1-uid",
                        profile: { name: "player1" },
                        session: {
                            siteId: "site-1",
                            currencyName: "USD",
                            currencyCode: "USD",
                            multiplier: 1.0,
                            operatorId: "op-1",
                            playerId: "player-1",
                            rate: 1.0,
                        },
                    },
                    true
                );
                expect(gameData.ingame.player1).toEqual({
                    activeBet: {
                        roundId: "round-1",
                        tapCount: 1,
                        currentMultiplier: 2.5,
                        amount: 100,
                        multiplierMode: 2,
                    },
                });
            });

            it("should skip rounds with no bet logs", async () => {
                // Arrange
                const unsettledRounds = [
                    {
                        id: "round-1",
                        uid: "player1-uid",
                        name: "player1",
                        amount: 100,
                        multiplierMode: 2,
                    },
                ];

                roundsRepository.find.mockReturnValue({
                    lean: jest.fn().mockReturnValue({
                        exec: jest.fn().mockResolvedValue(unsettledRounds),
                    }),
                });

                betLogsRepository.find.mockReturnValue({
                    lean: jest.fn().mockReturnValue({
                        exec: jest.fn().mockResolvedValue([]),
                    }),
                });

                const unsettledRoundConsumer = initConsumer();

                // Act
                await unsettledRoundConsumer.proceed();

                // Assert
                expect(settleCashOutConsumer.proceedCashOut).not.toHaveBeenCalled();
            });

            it("should handle multiple unsettled rounds", async () => {
                // Arrange
                const unsettledRounds = [
                    {
                        id: "round-1",
                        uid: "player1-uid",
                        name: "player1",
                        amount: 100,
                        multiplierMode: 2,
                    },
                    {
                        id: "round-2",
                        uid: "player2-uid",
                        name: "player2",
                        amount: 200,
                        multiplierMode: 3,
                    },
                ];

                const betLogs1 = [
                    {
                        siteId: "site-1",
                        currency: "USD",
                        operatorId: "op-1",
                        playerId: "player-1",
                        rate: 1.0,
                        currencyMultiplier: 1.0,
                        currencyCode: "USD",
                        multiplier: 2.5,
                    },
                ];

                const betLogs2 = [
                    {
                        siteId: "site-2",
                        currency: "EUR",
                        operatorId: "op-2",
                        playerId: "player-2",
                        rate: 0.85,
                        currencyMultiplier: 1.2,
                        currencyCode: "EUR",
                        multiplier: 3.0,
                    },
                ];

                roundsRepository.find.mockReturnValue({
                    lean: jest.fn().mockReturnValue({
                        exec: jest.fn().mockResolvedValue(unsettledRounds),
                    }),
                });

                betLogsRepository.find
                    .mockReturnValueOnce({
                        lean: jest.fn().mockReturnValue({
                            exec: jest.fn().mockResolvedValue(betLogs1),
                        }),
                    })
                    .mockReturnValueOnce({
                        lean: jest.fn().mockReturnValue({
                            exec: jest.fn().mockResolvedValue(betLogs2),
                        }),
                    });

                settleCashOutConsumer.proceedCashOut.mockResolvedValue();

                const unsettledRoundConsumer = initConsumer();

                // Act
                await unsettledRoundConsumer.proceed();

                // Assert
                expect(settleCashOutConsumer.proceedCashOut).toHaveBeenCalledTimes(2);
            });

            it("should calculate tapCount from bet logs length", async () => {
                // Arrange
                const unsettledRounds = [
                    {
                        id: "round-1",
                        uid: "player1-uid",
                        name: "player1",
                        amount: 100,
                        multiplierMode: 2,
                    },
                ];

                const betLogs = [
                    {
                        siteId: "site-1",
                        currency: "USD",
                        operatorId: "op-1",
                        playerId: "player-1",
                        rate: 1.0,
                        currencyMultiplier: 1.0,
                        currencyCode: "USD",
                        multiplier: 2.5,
                    },
                    {
                        siteId: "site-1",
                        currency: "USD",
                        operatorId: "op-1",
                        playerId: "player-1",
                        rate: 1.0,
                        currencyMultiplier: 1.0,
                        currencyCode: "USD",
                        multiplier: 3.0,
                    },
                ];

                roundsRepository.find.mockReturnValue({
                    lean: jest.fn().mockReturnValue({
                        exec: jest.fn().mockResolvedValue(unsettledRounds),
                    }),
                });

                betLogsRepository.find.mockReturnValue({
                    lean: jest.fn().mockReturnValue({
                        exec: jest.fn().mockResolvedValue(betLogs),
                    }),
                });

                settleCashOutConsumer.proceedCashOut.mockResolvedValue();

                const unsettledRoundConsumer = initConsumer();

                // Act
                await unsettledRoundConsumer.proceed();

                // Assert
                expect(gameData.ingame.player1.activeBet.tapCount).toBe(2);
            });
        });
    });
});
