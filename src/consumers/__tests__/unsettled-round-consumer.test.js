import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import CrashGameData from "../../game-data";
import { SettleCashOutConsumer } from "../settle-cash-out-consumer";
import { UnsettledRoundConsumer } from "../unsettled-round-consumer";

let gameData;

/** @type {mongoose.Model}*/
const roundsRepository = stubMongoose(mongoose.Model);
roundsRepository.deleteOne = jest.fn();

/** @type {mongoose.Model}*/
const betLogsRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const recentBetsRepository = stubMongoose(mongoose.Model);
recentBetsRepository.deleteOne = jest.fn();

/** @type {mongoose.Model}*/
const roundRmRepository = stubMongoose(mongoose.Model);
roundRmRepository.create = jest.fn();

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
        recentBetsRepository,
        settleCashOutConsumer,
        roundRmRepository,
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
                expect(settleCashOutConsumer.proceedCashOut).toHaveBeenCalledWith({
                    player: {
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
                    isAutoCashOut: true,
                    isUserDisconnect: true,
                });
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

            it("should skip rounds with no bet logs and move them to roundRmRepository", async () => {
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

                roundsRepository.deleteOne.mockResolvedValue({});
                recentBetsRepository.deleteOne.mockResolvedValue({});

                betLogsRepository.find.mockReturnValue({
                    lean: jest.fn().mockReturnValue({
                        exec: jest.fn().mockResolvedValue([]),
                    }),
                });

                roundRmRepository.create.mockResolvedValue({});

                const unsettledRoundConsumer = initConsumer();

                // Act
                await unsettledRoundConsumer.proceed();

                // Assert
                expect(settleCashOutConsumer.proceedCashOut).not.toHaveBeenCalled();
                expect(roundRmRepository.create).toHaveBeenCalledWith(unsettledRounds[0]);
                expect(roundsRepository.deleteOne).toHaveBeenCalledWith({ id: "round-1" });
                expect(recentBetsRepository.deleteOne).toHaveBeenCalledWith({ roundId: "round-1" });
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

        describe("when processing multiple rounds with mixed scenarios", () => {
            const unsettledRounds = [
                { id: "r1", uid: "uid1", name: "player1", amount: 150, multiplierMode: 2 },
                { id: "r2", uid: "uid2", name: "player2", amount: 250, multiplierMode: 3 },
                { id: "r3", uid: "uid3", name: "player3", amount: 350, multiplierMode: 4 },
                { id: "r4", uid: "uid4", name: "player4", amount: 450, multiplierMode: 5 },
            ];

            const betLogsForRounds = {
                r1: [
                    {
                        siteId: "site-1",
                        currency: "USD",
                        operatorId: "op-1",
                        playerId: "player-1",
                        rate: 1.0,
                        currencyMultiplier: 1.0,
                        currencyCode: "USD",
                        multiplier: 2.5,
                    }
                ],
                r2: [],
                r3: [
                    {
                        siteId: "site-2",
                        currency: "EUR",
                        operatorId: "op-2",
                        playerId: "player-3",
                        rate: 2.0,
                        currencyMultiplier: 2.0,
                        currencyCode: "EUR",
                        multiplier: 3.5,
                    },
                    {
                        siteId: "site-2",
                        currency: "EUR",
                        operatorId: "op-2",
                        playerId: "player-3",
                        rate: 2.0,
                        currencyMultiplier: 2.0,
                        currencyCode: "EUR",
                        multiplier: 4.5,
                    }
                ],
                r4: []
            };

            beforeEach(() => {
                roundsRepository.find.mockReturnValue({
                    lean: jest.fn().mockReturnValue({
                        exec: jest.fn().mockResolvedValue(unsettledRounds),
                    }),
                });

                roundsRepository.deleteOne.mockResolvedValue({});
                recentBetsRepository.deleteOne.mockResolvedValue({});

                betLogsRepository.find.mockImplementation(({ roundId }) => ({
                    lean: jest.fn().mockReturnValue({
                        exec: jest.fn().mockResolvedValue(betLogsForRounds[roundId] || []),
                    }),
                }));

                roundRmRepository.create.mockResolvedValue({});
                settleCashOutConsumer.proceedCashOut.mockResolvedValue();
            });

            it("should set gameData.ingame only for rounds with bet logs", async () => {
                // Arrange
                const unsettledRoundConsumer = initConsumer();

                // Act
                await unsettledRoundConsumer.proceed();

                // Assert
                expect(gameData.ingame["player1"]).toBeDefined();
                expect(gameData.ingame["player1"].activeBet.tapCount).toBe(1);
                expect(gameData.ingame["player1"].activeBet.roundId).toBe("r1");
                expect(gameData.ingame["player1"].activeBet.amount).toBe(150);
                expect(gameData.ingame["player1"].activeBet.multiplierMode).toBe(2);

                expect(gameData.ingame["player3"]).toBeDefined();
                expect(gameData.ingame["player3"].activeBet.tapCount).toBe(2);
                expect(gameData.ingame["player3"].activeBet.roundId).toBe("r3");
                expect(gameData.ingame["player3"].activeBet.amount).toBe(350);
                expect(gameData.ingame["player3"].activeBet.multiplierMode).toBe(4);

                expect(gameData.ingame["player2"]).toBeUndefined();
                expect(gameData.ingame["player4"]).toBeUndefined();
            });

            it("should call settleCashOutConsumer only for rounds with bet logs", async () => {
                // Arrange
                const unsettledRoundConsumer = initConsumer();

                // Act
                await unsettledRoundConsumer.proceed();

                // Assert
                expect(settleCashOutConsumer.proceedCashOut).toHaveBeenCalledTimes(2);
                expect(settleCashOutConsumer.proceedCashOut).toHaveBeenCalledWith(
                    expect.objectContaining({
                        player: expect.objectContaining({
                            UID: "uid1",
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
                        }),
                        isAutoCashOut: true,
                        isUserDisconnect: true,
                    })
                );
                expect(settleCashOutConsumer.proceedCashOut).toHaveBeenCalledWith(
                    expect.objectContaining({
                        player: expect.objectContaining({
                            UID: "uid3",
                            profile: { name: "player3" },
                            session: {
                                siteId: "site-2",
                                currencyName: "EUR",
                                currencyCode: "EUR",
                                multiplier: 2.0,
                                operatorId: "op-2",
                                playerId: "player-3",
                                rate: 2.0,
                            },
                        }),
                        isAutoCashOut: true,
                        isUserDisconnect: true,
                    })
                );
            });

            it("should move rounds without bet logs to roundRmRepository", async () => {
                // Arrange
                const unsettledRoundConsumer = initConsumer();

                // Act
                await unsettledRoundConsumer.proceed();

                // Assert
                expect(roundRmRepository.create).toHaveBeenCalledTimes(2);
                expect(roundRmRepository.create).toHaveBeenCalledWith(unsettledRounds[1]); // r2
                expect(roundRmRepository.create).toHaveBeenCalledWith(unsettledRounds[3]); // r4
            });

            it("should delete rounds without bet logs from roundsRepository", async () => {
                // Arrange
                const unsettledRoundConsumer = initConsumer();

                // Act
                await unsettledRoundConsumer.proceed();

                // Assert
                expect(roundsRepository.deleteOne).toHaveBeenCalledTimes(2);
                expect(roundsRepository.deleteOne).toHaveBeenCalledWith({ id: "r2" });
                expect(roundsRepository.deleteOne).toHaveBeenCalledWith({ id: "r4" });
            });

            it("should delete recent bets for rounds without bet logs from recentBetsRepository", async () => {
                // Arrange
                const unsettledRoundConsumer = initConsumer();

                // Act
                await unsettledRoundConsumer.proceed();

                // Assert
                expect(recentBetsRepository.deleteOne).toHaveBeenCalledTimes(2);
                expect(recentBetsRepository.deleteOne).toHaveBeenCalledWith({ roundId: "r2" });
                expect(recentBetsRepository.deleteOne).toHaveBeenCalledWith({ roundId: "r4" });
            });

            it("should not call settleCashOutConsumer for rounds without bet logs", async () => {
                // Arrange
                const unsettledRoundConsumer = initConsumer();

                // Act
                await unsettledRoundConsumer.proceed();

                // Assert
                expect(settleCashOutConsumer.proceedCashOut).not.toHaveBeenCalledWith(
                    expect.objectContaining({
                        player: expect.objectContaining({ profile: { name: "player2" } }),
                    })
                );
                expect(settleCashOutConsumer.proceedCashOut).not.toHaveBeenCalledWith(
                    expect.objectContaining({
                        player: expect.objectContaining({ profile: { name: "player4" } }),
                    })
                );
            });
        });
        });
    });
});
