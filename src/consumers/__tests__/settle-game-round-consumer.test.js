import Chance from "chance";
import { Models } from "jest-auto-fixture";
import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { RoundResultPublisher, UserBetResultPublisher } from "sc-game-base/src/core/event-publishers";
import GameDefinition from "sc-game-base/src/core/game-definition";
import CrashGameData from "../../game-data";
import { SettleGameRoundConsumer } from "../settle-game-round-consumer";
import { Actions } from "../../constants";

describe("SettleGameRoundConsumer", () => {
    const chance = new Chance();
    const defaultDefinition = new GameDefinition({ id: 1, name: "game name" }, jest.fn(), jest.fn());
    const roundId = chance.natural();

    const defaultGameData = new CrashGameData(30);
    defaultGameData.gameConfigs = Models.GameConfig({});

    let gameData, definition, consumer;

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

    /** @type {mongoose.Model}*/
    const tempBetsRepository = stubMongoose(mongoose.Model);

    /** @type {mongoose.Model}*/
    const tempBetLogsRepository = stubMongoose(mongoose.Model);

    const endGame = jest.fn();

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
            tempBetsRepository,
            tempBetLogsRepository,
        });
    });

    describe("calculateWinAmount", () => {
        describe("when bet logs is empty", () => {
            it("should return 0", () => {
                // Arrange
                const emptyBetLogs = [];

                // Act
                const result = consumer.calculateWinAmount(emptyBetLogs);

                // Assert
                expect(result).toBe(0);
            });

            it("should return 0 when bet logs is null", () => {
                // Arrange
                const nullBetLogs = null;

                // Act
                const result = consumer.calculateWinAmount(nullBetLogs);

                // Assert
                expect(result).toBe(0);
            });

            it("should return 0 when bet logs is undefined", () => {
                // Arrange
                const undefinedBetLogs = undefined;

                // Act
                const result = consumer.calculateWinAmount(undefinedBetLogs);

                // Assert
                expect(result).toBe(0);
            });
        });

        describe("when bet logs contain cashout action", () => {
            it("should calculate win amount correctly", () => {
                // Arrange
                const amount = chance.natural();
                const multiplier = chance.floating({ min: 1, max: 2 });
                const betLogs = [
                    {
                        action: Actions.CashOut,
                        amount,
                        multiplier,
                    },
                ];

                // Act
                const result = consumer.calculateWinAmount(betLogs);

                // Assert
                expect(result).toBe(amount * multiplier);
            });

            it("should handle zero amount", () => {
                // Arrange
                const betLogs = [
                    {
                        action: Actions.CashOut,
                        amount: 0,
                        multiplier: 1.5,
                    },
                ];

                // Act
                const result = consumer.calculateWinAmount(betLogs);

                // Assert
                expect(result).toBe(0);
            });
        });

        describe("when bet logs don't contain cashout action", () => {
            it("should return 0 when no cashout action exists", () => {
                // Arrange
                const betLogs = [
                    {
                        action: Actions.Mine,
                        amount: 100,
                        multiplier: 1.5,
                    },
                ];

                // Act
                const result = consumer.calculateWinAmount(betLogs);

                // Assert
                expect(result).toBe(0);
            });

            it("should return 0 for mixed actions without cashout", () => {
                // Arrange
                const betLogs = [
                    { action: Actions.Mine, amount: 100 },
                    { action: Actions.Bet, amount: 200 },
                ];

                // Act
                const result = consumer.calculateWinAmount(betLogs);

                // Assert
                expect(result).toBe(0);
            });
        });
    });

    describe("calculateBetResult", () => {
        beforeEach(() => {
            consumer.calculateWinAmount = jest.fn();
        });

        describe("when calculating total bet amount", () => {
            it("should return bet amount with 2 decimal places", () => {
                // Arrange
                const betAmount = chance.floating({ min: 1, max: 1000 });
                const winAmount = chance.floating({ min: 1, max: 1000 });
                const bet = { amount: betAmount };
                consumer.calculateWinAmount.mockReturnValue(winAmount);

                // Act
                const { totalBetAmount } = consumer.calculateBetResult(bet, []);

                // Assert
                expect(totalBetAmount).toBe(+betAmount.toFixed(2));
            });
        });

        describe("when win amount is greater than bet amount", () => {
            it("should calculate netWin correctly", () => {
                // Arrange
                const betAmount = 100;
                const winAmount = 150;
                consumer.calculateWinAmount.mockReturnValue(winAmount);

                // Act
                const { netWin } = consumer.calculateBetResult({ amount: betAmount }, []);

                // Assert
                expect(netWin).toBe(+(winAmount - betAmount).toFixed(2));
            });

            it("should set totalLost to 0", () => {
                // Arrange
                const betAmount = 100;
                const winAmount = 150;
                consumer.calculateWinAmount.mockReturnValue(winAmount);

                // Act
                const { totalLost } = consumer.calculateBetResult({ amount: betAmount }, []);

                // Assert
                expect(totalLost).toBe(0);
            });
        });

        describe("when win amount is less than bet amount", () => {
            it("should set netWin to 0", () => {
                // Arrange
                const betAmount = 150;
                const winAmount = 100;
                consumer.calculateWinAmount.mockReturnValue(winAmount);

                // Act
                const { netWin } = consumer.calculateBetResult({ amount: betAmount }, []);

                // Assert
                expect(netWin).toBe(0);
            });

            it("should calculate totalLost correctly", () => {
                // Arrange
                const betAmount = 150;
                const winAmount = 100;
                consumer.calculateWinAmount.mockReturnValue(winAmount);

                // Act
                const { totalLost } = consumer.calculateBetResult({ amount: betAmount }, []);

                // Assert
                expect(totalLost).toBe(+(betAmount - winAmount).toFixed(2));
            });
        });

        describe("when win amount equals bet amount", () => {
            it("should set both netWin and totalLost to 0", () => {
                // Arrange
                const amount = chance.natural();
                consumer.calculateWinAmount.mockReturnValue(amount);

                // Act
                const result = consumer.calculateBetResult({ amount }, []);

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
                consumer.calculateWinAmount.mockReturnValue(winAmount);

                // Act
                const result = consumer.calculateBetResult({ amount: betAmount }, []);

                // Assert
                expect(result.totalBetAmount).toBe(+betAmount.toFixed(2));
                expect(result.totalWin).toBe(+winAmount.toFixed(2));
                expect(result.netWin).toBe(+(winAmount - betAmount).toFixed(2));
                expect(result.totalLost).toBe(0);
            });
        });
    });

    describe("settleRound", () => {
        const roundId = chance.natural();
        const time = new Date();

        beforeEach(() => {
            // Reset all mocks
            jest.clearAllMocks();

            // Setup mocks for methods
            consumer.queryRound = jest.fn();
            consumer.queryBetLogs = jest.fn();
            consumer.calculateBetResult = jest.fn();
            consumer.getMineResults = jest.fn();
            consumer.updatePlayerBetTracks = jest.fn();

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
                consumer.queryBetLogs.mockResolvedValue(null);

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
                consumer.queryBetLogs.mockResolvedValue(null);

                // Act
                await consumer.settleRound({ roundId, time });

                // Assert
                expect(consumer.calculateBetResult).not.toHaveBeenCalled();
                expect(consumer.getMineResults).not.toHaveBeenCalled();
                expect(consumer.updatePlayerBetTracks).not.toHaveBeenCalled();
            });
        });

        describe("when round data is valid", () => {
            const mockRound = {
                id: roundId,
                uid: chance.guid(),
                name: chance.word(),
                save: jest.fn(),
            };

            const mockBetLogs = [
                {
                    action: "Mine",
                    result: chance.natural(),
                },
            ];

            beforeEach(() => {
                // Setup mocks for valid round scenario
                consumer.queryRound.mockResolvedValue(mockRound);
                consumer.queryBetLogs.mockResolvedValue(mockBetLogs);
                consumer.calculateBetResult.mockReturnValue({
                    totalWin: chance.natural(),
                });
                consumer.getMineResults.mockReturnValue({
                    result: [1, 2, 3],
                    settlementResult: [1, 2, 3],
                    tapCount: 3,
                });
                consumer.callEndGame = jest.fn();
                consumer.userBetResultPublisher = {
                    publish: jest.fn(),
                };
            });

            it("should update round with bet result", async () => {
                // Arrange
                const betResult = { totalWin: chance.natural() };
                consumer.calculateBetResult.mockReturnValue(betResult);

                // Act
                await consumer.settleRound({ roundId, time });

                // Assert
                expect(mockRound.betwin).toBe(betResult.totalWin);
                expect(mockRound.paid).toBe(true);
            });

            it("should update round with mine results", async () => {
                // Arrange
                const mineResults = {
                    result: [1, 2],
                    settlementResult: [1, 2],
                    tapCount: 2,
                };
                consumer.getMineResults.mockReturnValue(mineResults);

                // Act
                await consumer.settleRound({ roundId, time });

                // Assert
                expect(mockRound.result).toEqual(mineResults.result);
                expect(mockRound.settlementResult).toEqual(mineResults.settlementResult);
                expect(mockRound.tapCount).toBe(mineResults.tapCount);
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
                const betResult = { totalWin: chance.natural() };
                consumer.calculateBetResult.mockReturnValue(betResult);

                // Act
                await consumer.settleRound({ roundId, time });

                // Assert
                expect(consumer.callEndGame).toHaveBeenCalledWith(mockRound, roundId, time, betResult);
            });

            it("should publish bet result to user", async () => {
                // Arrange
                const betResult = { totalWin: chance.natural() };
                consumer.calculateBetResult.mockReturnValue(betResult);

                // Act
                await consumer.settleRound({ roundId, time });

                // Assert
                expect(consumer.userBetResultPublisher.publish).toHaveBeenCalledWith(mockRound.uid, {
                    ...betResult,
                    reachMaxWin: false,
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
                expect(consumer.logService.logError).toHaveBeenCalledWith(expect.stringContaining("Failed to settle round"), error);
            });
        });
    });

    describe("queryRound", () => {
        it("should query round by id", async () => {
            // Arrange
            const roundId = chance.natural();
            const expectedRound = [{ id: roundId }];
            roundsRepository.find().exec.mockResolvedValue(expectedRound);

            // Act
            const result = await consumer.queryRound(roundId);

            // Assert
            expect(roundsRepository.find).toHaveBeenCalledWith({ id: roundId });
            expect(result).toEqual(expectedRound);
        });
    });

    describe("queryBetLogs", () => {
        it("should combine real player and bot bet logs", async () => {
            // Arrange
            const roundId = chance.natural();
            const realPlayerLogs = [{ id: 1, type: "real" }];
            const botLogs = [{ id: 2, type: "bot" }];

            betLogsRepository.find().lean().exec.mockResolvedValue(realPlayerLogs);
            tempBetLogsRepository.find().lean().exec.mockResolvedValue(botLogs);

            // Act
            const result = await consumer.queryBetLogs(roundId);

            // Assert
            expect(result).toEqual([...realPlayerLogs, ...botLogs]);
        });

        it("should query both repositories with correct roundId", async () => {
            // Arrange
            const roundId = chance.natural();
            betLogsRepository.find().lean().exec.mockResolvedValue([]);
            tempBetLogsRepository.find().lean().exec.mockResolvedValue([]);

            // Act
            await consumer.queryBetLogs(roundId);

            // Assert
            expect(betLogsRepository.find).toHaveBeenCalledWith({ roundId });
            expect(tempBetLogsRepository.find).toHaveBeenCalledWith({ roundId });
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

    describe("getMineResults", () => {
        it("should extract mine results from bet logs", () => {
            // Arrange
            const betLogs = [
                { action: Actions.Mine, result: 1 },
                { action: Actions.Mine, result: 2 },
                { action: Actions.CashOut, result: 3 },
            ];

            // Act
            const { result, settlementResult, tapCount } = consumer.getMineResults(betLogs);

            // Assert
            expect(result).toEqual([1, 2]);
            expect(settlementResult).toEqual([1, 2]);
            expect(tapCount).toBe(2);
        });

        it("should handle empty bet logs", () => {
            // Arrange
            const emptyBetLogs = [];

            // Act
            const { result, settlementResult, tapCount } = consumer.getMineResults(emptyBetLogs);

            // Assert
            expect(result).toEqual([]);
            expect(settlementResult).toEqual([]);
            expect(tapCount).toBe(0);
        });

        it("should handle bet logs without mine actions", () => {
            // Arrange
            const betLogs = [
                { action: Actions.CashOut, result: 1 },
                { action: Actions.Bet, result: 2 },
            ];

            // Act
            const { result, settlementResult, tapCount } = consumer.getMineResults(betLogs);

            // Assert
            expect(result).toEqual([]);
            expect(settlementResult).toEqual([]);
            expect(tapCount).toBe(0);
        });

        it("should count only mine actions", () => {
            // Arrange
            const betLogs = [
                { action: Actions.Mine, result: 1 },
                { action: Actions.Bet, result: 2 },
                { action: Actions.Mine, result: 3 },
                { action: Actions.CashOut, result: 4 },
            ];

            // Act
            const { result, settlementResult, tapCount } = consumer.getMineResults(betLogs);

            // Assert
            expect(result).toEqual([1, 3]);
            expect(settlementResult).toEqual([1, 3]);
            expect(tapCount).toBe(2);
        });

        it("should handle null or undefined results", () => {
            // Arrange
            const betLogs = [
                { action: Actions.Mine, result: null },
                { action: Actions.Mine, result: undefined },
                { action: Actions.Mine, result: 3 },
            ];

            // Act
            const { result, settlementResult, tapCount } = consumer.getMineResults(betLogs);

            // Assert
            expect(result).toEqual([null, undefined, 3]);
            expect(settlementResult).toEqual([null, undefined, 3]);
            expect(tapCount).toBe(3);
        });

        it("should handle random mine results", () => {
            // Arrange
            const mineResults = [chance.natural(), chance.natural(), chance.natural()];
            const betLogs = mineResults.map((result) => ({
                action: Actions.Mine,
                result,
            }));

            // Act
            const { result, settlementResult, tapCount } = consumer.getMineResults(betLogs);

            // Assert
            expect(result).toEqual(mineResults);
            expect(settlementResult).toEqual(mineResults);
            expect(tapCount).toBe(mineResults.length);
        });

        it("should handle large number of bet logs", () => {
            // Arrange
            const numberOfLogs = 100;
            const betLogs = Array.from({ length: numberOfLogs }, () => ({
                action: Actions.Mine,
                result: chance.natural(),
            }));

            // Act
            const { result, settlementResult, tapCount } = consumer.getMineResults(betLogs);

            // Assert
            expect(result.length).toBe(numberOfLogs);
            expect(settlementResult.length).toBe(numberOfLogs);
            expect(tapCount).toBe(numberOfLogs);
        });
    });
});
