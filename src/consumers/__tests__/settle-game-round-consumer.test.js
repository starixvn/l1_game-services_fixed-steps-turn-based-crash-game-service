import Chance from "chance";
import { Models } from "jest-auto-fixture";
import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { RoundResultPublisher, UserBetResultPublisher } from "sc-game-base/src/core/event-publishers";
import GameDefinition from "sc-game-base/src/core/game-definition";
import { Actions } from "../../constants";
import { ProvablyFairConsumer, SettleGameRoundConsumer } from "../../consumers";
import CrashGameData from "../../game-data";
import { decrypt } from "../../helpers/crypto-helper";

jest.mock("../../helpers/crypto-helper", () => ({
    decrypt: jest.fn(),
}));

describe("SettleGameRoundConsumer", () => {
    const chance = new Chance();
    const defaultDefinition = new GameDefinition({ id: 1, name: "game name" }, jest.fn(), jest.fn());
    const roundId = chance.natural();

    const defaultGameData = new CrashGameData(30);
    defaultGameData.gameConfigs = Models.GameConfig({});

    /** @type {CrashGameData}*/
    let gameData;
    /** @type {GameDefinition}*/
    let definition;
    /** @type {SettleGameRoundConsumer}*/
    let consumer;

    /** @type {UserRoundResultPublisher}*/
    const roundResultPublisher = stub(RoundResultPublisher);

    /** @type {UserBetResultPublisher}*/
    const userBetResultPublisher = stub(UserBetResultPublisher);

    /** @type {mongoose.Model}*/
    const roundsRepository = stubMongoose(mongoose.Model);

    /** @type {mongoose.Model}*/
    const betsRepository = stubMongoose(mongoose.Model);

    /** @type {mongoose.Model}*/
    const betLogsRepository = stubMongoose(mongoose.Model);
    betLogsRepository.insertMany = jest.fn();

    const endGame = jest.fn();

    const logService = {
        logError: jest.fn(),
    };

    /** @type {ProvablyFairConsumer}*/
    const provablyFairConsumer = stub(ProvablyFairConsumer);

    /** @type {mongoose.Model}*/
    const resultsRepository = stubMongoose(mongoose.Model);

    beforeEach(() => {
        jest.clearAllMocks();
        gameData = { ...defaultGameData };
        definition = { ...defaultDefinition };

        consumer = new SettleGameRoundConsumer({
            definition,
            gameData,
            roundResultPublisher,
            userBetResultPublisher,
            endGame,
            roundsRepository,
            betsRepository,
            betLogsRepository,
            logService,
            provablyFairConsumer,
            resultsRepository,
        });
    });

    describe("calculateBetResult", () => {

        describe("when calculating total bet amount", () => {
            it("should return bet amount with 2 decimal places", () => {
                // Arrange
                const betAmount = chance.floating({ min: 1, max: 1000 });
                const winAmount = chance.floating({ min: 1, max: 1000 });

                // Act
                const { totalBetAmount } = consumer.calculateBetResult(betAmount, winAmount);

                // Assert
                expect(totalBetAmount).toBe(+betAmount.toFixed(2));
            });
        });

        describe("when win amount is greater than bet amount", () => {
            it("should calculate netWin correctly", () => {
                // Arrange
                const betAmount = 100;
                const winAmount = 150;

                // Act
                const { netWin } = consumer.calculateBetResult(betAmount, winAmount);

                // Assert
                expect(netWin).toBe(50); // (150 - 100).toFixed(2)
            });

            it("should set totalLost to 0", () => {
                // Arrange
                const betAmount = 100;
                const winAmount = 150;

                // Act
                const { totalLost } = consumer.calculateBetResult(betAmount, winAmount);

                // Assert
                expect(totalLost).toBe(0);
            });
        });

        describe("when win amount is less than bet amount", () => {
            it("should set netWin to 0", () => {
                // Arrange
                const betAmount = 150;
                const winAmount = 100;

                // Act
                const { netWin } = consumer.calculateBetResult(betAmount, winAmount);

                // Assert
                expect(netWin).toBe(0);
            });

            it("should calculate totalLost correctly", () => {
                // Arrange
                const betAmount = 150;
                const winAmount = 100;

                // Act
                const { totalLost } = consumer.calculateBetResult(betAmount, winAmount);

                // Assert
                expect(totalLost).toBe(50); // (150 - 100).toFixed(2)
            });
        });

        describe("when win amount equals bet amount", () => {
            it("should set both netWin and totalLost to 0", () => {
                // Arrange
                const betAmount = chance.natural();
                const winAmount = betAmount;

                // Act
                const result = consumer.calculateBetResult(betAmount, winAmount);

                // Assert
                expect(result.netWin).toBe(0);
                expect(result.totalLost).toBe(0);
            });
        });

        describe("when handling decimal precision", () => {
            it("should round all values to 2 decimal places", () => {
                // Arrange
                const betAmount = 100.123;
                const winAmount = 150.456;

                // Act
                const result = consumer.calculateBetResult(betAmount, winAmount);

                // Assert
                expect(result.totalBetAmount).toBe(+betAmount.toFixed(2));
                expect(result.totalWin).toBe(+winAmount.toFixed(2));
                expect(result.netWin).toBe(+(winAmount - betAmount).toFixed(2));
                expect(result.totalLost).toBe(0);
            });
        });
    });

    describe("settleRound", () => {
        const time = new Date();

        beforeEach(() => {
            // Reset all mocks
            jest.clearAllMocks();

            // Setup mocks for methods
            consumer.queryRound = jest.fn();
            consumer.resultsRepository = {
                findOne: () => {
                    return {
                        lean: () => {
                            return {
                                exec: jest.fn(),
                            };
                        },
                    };
                },
            };
            consumer.queryBetLogs = jest.fn();

            // Setup logService mock if it doesn't exist
            consumer.logService = {
                logError: jest.fn(),
            };
        });

        describe("when round data is invalid", () => {
            it("should log error when round is not found", async () => {
                // Arrange
                consumer.queryRound.mockResolvedValue(null);
                consumer.queryBetLogs.mockResolvedValue([]);

                // Act
                await consumer.settleRound({ roundId, time });

                // Assert
                expect(consumer.logService.logError).toHaveBeenCalledWith(
                    `${consumer.definition.name} Settle Error: Invalid round data: ${roundId}`
                );
            });

            it("should log error when bet logs are not found", async () => {
                // Arrange
                consumer.queryRound.mockResolvedValue({ id: roundId });
                consumer.queryBetLogs.mockResolvedValue([]);

                // Act
                await consumer.settleRound({ roundId, time });

                // Assert
                expect(consumer.logService.logError).toHaveBeenCalledWith(
                    `${consumer.definition.name} Settle Error: Invalid round data: ${roundId}`
                );
            });

            it("should return early without processing when data is invalid", async () => {
                // Arrange
                consumer.queryRound.mockResolvedValue(null);
                consumer.queryBetLogs.mockResolvedValue([]);
                jest.spyOn(consumer, "calculateBetResult");

                // Act
                await consumer.settleRound({ roundId, time });

                // Assert
                expect(consumer.calculateBetResult).not.toHaveBeenCalled();
            });
        });

        describe("when round data is valid", () => {
            const { roundMultiplier } = require("../../helpers/number-helper");

            const player = {
                UID: chance.guid(),
                profile: {
                    name: chance.word(),
                },
            };
            const mockRound = {
                id: roundId,
                tapCount: 2,
                result: 2.5,
                betAmount: 100,
                amount: 100,
                totalAmount: 100,
                maxWin: 1000,
                betwin: 100,
                betWin: 102,
                uid: chance.guid(),
                name: player.profile.name,
                save: jest.fn(),
            };

            const mockBetLogs = [
                {
                    action: Actions.Bet,
                    result: chance.natural(),
                    multiplier: 1.01,
                    amount: 100,
                    winAmount: 101,
                    reachMaxWin: false,
                },
                {
                    action: Actions.Mine,
                    result: chance.natural(),
                    multiplier: 1.02,
                    amount: 100,
                    winAmount: 102,
                    reachMaxWin: false,
                },
                {
                    action: Actions.CashOut,
                    result: chance.natural(),
                    multiplier: 1.02,
                    amount: 100,
                    winAmount: 102,
                    reachMaxWin: false,
                    rate: 1.0,
                },
            ];

            beforeEach(() => {
                // Setup mocks for valid round scenario
                consumer.queryRound.mockResolvedValue(mockRound);
                consumer.queryBetLogs.mockResolvedValue(mockBetLogs);

                consumer.resultsRepository = {
                    findOne: () => {
                        return {
                            lean: () => {
                                return {
                                    exec: jest.fn().mockReturnValue({
                                        roundId: roundId,
                                    }),
                                };
                            },
                        };
                    },
                };

                consumer.callEndGame = jest.fn();
                consumer.userBetResultPublisher = {
                    publish: jest.fn(),
                };

                decrypt.mockReturnValue("2.5");
                consumer.provablyFairConsumer = {
                    generateServerSeedAndPublishHash: jest.fn(),
                };
            });

            it("should update round with bet result", async () => {
                // Arrange
                const betResult = { totalWin: chance.natural() };
                consumer.calculateBetResult = jest.fn().mockReturnValue(betResult);

                // Act
                await consumer.settleRound({ roundId, time });

                // Assert
                expect(mockRound.betwin).toBe(betResult.totalWin);
                expect(mockRound.betWin).toBe(betResult.totalWin);
                expect(mockRound.paid).toBe(true);
                expect(mockRound.reachMaxWin).toBe(false);
            });

            it("should update round with mine results", async () => {
                // Arrange

                // Act
                await consumer.settleRound({ roundId, time });

                // Assert
                expect(mockRound.result).toEqual(2.5);
                expect(mockRound.tapCount).toBe(2);
            });

            it("should save round after updates", async () => {
                // Arrange
                mockRound.save.mockResolvedValue();

                // Act
                await consumer.settleRound({ roundId, time });

                // Assert
                expect(mockRound.save).toHaveBeenCalledTimes(1);
            });

            it("should call endGame with correct parameters", async () => {
                // Arrange
                const betResult = {
                    totalBetAmount: 100,
                    totalWin: 102,
                    netWin: 2, // (102 - 100).toFixed(2)
                    totalLost: 0,
                };
                consumer.calculateBetResult = jest.fn().mockReturnValue(betResult);

                // Act
                await consumer.settleRound({ roundId, time });

                // Assert
                expect(consumer.callEndGame).toHaveBeenCalledWith(mockRound, roundId, time, betResult);
            });

            describe("and player is provided", () => {
                const betResult = {
                    totalBetAmount: 100,
                    totalWin: 102,
                    netWin: 2,
                    totalLost: 0,
                };

                beforeEach(() => {
                    consumer.gameData = {
                        ingame: {
                            [player.profile.name]: {
                                betTracks: {},
                            },
                        },
                        provablyFair: {
                            [player.profile.name]: {
                                serverSeed: chance.string(),
                                serverSeedHash: chance.string(),
                            },
                        },
                    };
                    consumer.calculateBetResult = jest.fn().mockReturnValue(betResult);
                });

                it("should publish bet result to user", async () => {
                    // Act
                    await consumer.settleRound({ roundId, time, player, playerName: player.profile.name });

                    // Assert
                    expect(consumer.userBetResultPublisher.publish).toHaveBeenCalledWith(player.UID, {
                        ...betResult,
                        rate: mockBetLogs[2].rate,
                        reachMaxWin: false,
                    });
                });


                it("should updatePlayerBetTracks", async () => {
                    // Arrange
                    consumer.updatePlayerBetTracks = jest.fn();

                    // Act
                    await consumer.settleRound({ roundId, time, player, playerName: player.profile.name });

                    // Assert
                    expect(consumer.updatePlayerBetTracks).toHaveBeenCalledWith(player.profile.name);
                });

                it("should generateServerSeedAndPublishHash", async () => {
                    // Act
                    await consumer.settleRound({ roundId, time, player, playerName: player.profile.name });

                    // Assert
                    expect(consumer.provablyFairConsumer.generateServerSeedAndPublishHash).toHaveBeenCalledWith(
                        player.UID,
                        player.profile.name
                    );
                });
            });

            describe("and player is not provided", () => {
                beforeEach(() => {
                    consumer.userBetResultPublisher = {
                        publish: jest.fn(),
                    };
                    consumer.updatePlayerBetTracks = jest.fn();
                    consumer.provablyFairConsumer = {
                        generateServerSeedAndPublishHash: jest.fn(),
                    };
                });

                it("should not publish bet result to user", async () => {
                    // Act
                    await consumer.settleRound({ roundId, time });

                    // Assert
                    expect(consumer.userBetResultPublisher.publish).not.toHaveBeenCalled();
                });

                it("should not updatePlayerBetTracks", async () => {
                    // Act
                    await consumer.settleRound({ roundId, time });

                    // Assert
                    expect(consumer.updatePlayerBetTracks).not.toHaveBeenCalled();
                });

                it("should not generateServerSeedAndPublishHash", async () => {
                    // Act
                    await consumer.settleRound({ roundId, time });

                    // Assert
                    expect(consumer.provablyFairConsumer.generateServerSeedAndPublishHash).not.toHaveBeenCalled();
                });
            });
        });

        describe("error handling", () => {
            it("should log error when settlement fails", async () => {
                // Arrange
                const error = new Error("Settlement failed");
                consumer.queryRound.mockRejectedValue(error);

                // Act
                await expect(consumer.settleRound({ roundId, time })).rejects.toThrow(error);

                // Assert
                expect(consumer.logService.logError).toHaveBeenCalledWith(expect.stringContaining("Failed to settle round"));
            });
        });
    });

    describe("queryRound", () => {
        it("should query round by id", async () => {
            // Arrange
            const roundId = chance.natural();
            const expectedRound = { id: roundId };
            roundsRepository.findOne().exec.mockResolvedValue(expectedRound);

            // Act
            const result = await consumer.queryRound(roundId);

            // Assert
            expect(roundsRepository.findOne).toHaveBeenCalledWith({ id: roundId });
            expect(result).toEqual(expectedRound);
        });
    });

    describe("queryBetLogs", () => {
        it("should query with correct roundId", async () => {
            // Arrange
            const roundId = chance.natural();
            const expectedBetLogs = [
                {
                    id: chance.natural(),
                    roundId: roundId,
                },
            ];
            betLogsRepository.find().lean().exec.mockResolvedValue(expectedBetLogs);

            // Act
            const result = await consumer.queryBetLogs(roundId);

            // Assert
            expect(betLogsRepository.find).toHaveBeenCalledWith({ roundId });
            expect(result).toEqual(expectedBetLogs);
        });
    });

    describe("updatePlayerBetTracks", () => {
        beforeEach(() => {
            // Reset gameData before each test
            gameData.ingame = {};
        });

        it("should reset player bet tracks", () => {
            // Arrange
            const playerName = chance.word();
            gameData.ingame = {
                [playerName]: {
                    betTracks: { someExistingTrack: true },
                },
            };

            // Act
            consumer.updatePlayerBetTracks(playerName);

            // Assert
            expect(gameData.ingame[playerName].betTracks).toEqual({});
        });

        it("should handle player without betTracks property", () => {
            // Arrange
            const playerName = chance.word();
            gameData.ingame = {
                [playerName]: {},
            };

            // Act & Assert
            expect(() => {
                consumer.updatePlayerBetTracks(playerName);
            }).not.toThrow();
        });
    });
});
