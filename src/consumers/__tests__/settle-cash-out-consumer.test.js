import Chance from "chance";
import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { BaseEventPublisher } from "sc-game-base/src/core/event-publishers";
import { Actions } from "../../constants";
import { BigWinConsumer, SettleCashOutConsumer, SettleGameRoundConsumer } from "../../consumers";
import { RecentBigWinPublisher } from "../../event-publishers";
import GameData from "../../game-data";
import helpers from "../../helpers/notice-helper";
import { roundMultiplier } from "../../helpers/number-helper";
const chance = new Chance();

jest.mock("../../helpers/date-helper", () => ({
    addMillisecond: jest.fn(),
}));

jest.mock("../../helpers/number-helper", () => ({
    roundMultiplier: jest.fn(),
}));

describe("SettleCashOutConsumer", () => {
    const gameData = new GameData();
    gameData.updatePlayerAction = jest.fn();
    gameData.gameConfigs.crashConfig = {};
    gameData.result = 100;
    gameData.exchangeRates.exId = 1;

    const publisher = stub(BaseEventPublisher);

    const logService = {
        logError: jest.fn(),
    };
    const betLogsRepository = stubMongoose(mongoose.Model);

    /**
     * @type {BigWinConsumer}
     */
    const bigWinConsumer = stub(BigWinConsumer);
    /**
     * @type {SettleGameRoundConsumer}
     */
    const settleGameRoundConsumer = stub(SettleGameRoundConsumer);
    /**
     * @type {RecentBigWinPublisher}
     */
    const recentBigWinPublisher = stub(RecentBigWinPublisher);
    /**
     * @type {SettleCashOutConsumer}
     */
    let consumer;

    beforeEach(() => {
        consumer = new SettleCashOutConsumer({
            gameData,
            settleGameRoundConsumer,
            publisher,
            logService,
            betLogsRepository,
            bigWinConsumer,
            recentBigWinPublisher,
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const UID = "uid";
    const playerName = "name01";
    const realPlayer = {
        UID,
        socketClient: {
            connected: true,
        },
        profile: {
            name: playerName,
        },
        session: {
            userId: 1,
            playerId: 1,
            siteId: "123456",
            currencyCode: "USD",
            currencyName: "USD",
            multiplier: 1000,
            currencyGroupId: chance.guid(),
        },
    };

    describe("insertBetLog", () => {
        const roundId = chance.natural();
        const payload = {
            roundId,
            action: Actions.CashOut,
            tapCount: 1,
            amount: 1000,
            multiplier: 1.5,
            clientSendTime: new Date(),
            receivedTime: new Date(),
        };

        beforeEach(() => {
            consumer.calculateCurrencyRate = jest.fn();
        });

        it("should call calculateCurrencyRate", async () => {
            // Act
            await consumer.insertBetLog(realPlayer, roundId, payload);

            // Assert
            expect(consumer.calculateCurrencyRate).toHaveBeenCalledWith(realPlayer.session);
        });

        it("should call betLogsRepository.create with correct parameters", async () => {
            // Arrange
            const rate = chance.floating({ min: 1 });
            const mockDate = new Date();
            jest.spyOn(global, "Date").mockReturnValueOnce(mockDate);
            consumer.calculateCurrencyRate.mockReturnValueOnce(rate);
            roundMultiplier.mockReturnValue(1500);

            const bet = { ...payload, isAutoCashOut: true };
            realPlayer.session.operatorId = "operator123";

            // Act
            await consumer.insertBetLog(realPlayer, roundId, bet);

            // Assert
            expect(roundMultiplier).toHaveBeenCalledWith(bet.amount, bet.multiplier);
            expect(betLogsRepository.create).toHaveBeenCalledWith({
                uid: realPlayer.UID,
                name: realPlayer.profile.name,
                time: mockDate,
                action: bet.action,
                amount: bet.amount,
                clientSendTime: bet.clientSendTime,
                receivedTime: bet.receivedTime,
                roundId,
                multiplier: bet.multiplier,
                siteId: realPlayer.session.siteId,
                currency: realPlayer.session.currencyName,
                rate,
                operatorId: realPlayer.session.operatorId,
                playerId: realPlayer.session.playerId,
                tapCount: bet.tapCount,
                winAmount: 1500,
                isAutoCashOut: bet.isAutoCashOut,
                currencyCode: realPlayer.session.currencyCode,
                currencyMultiplier: realPlayer.session.multiplier,
            });
        });
    });

    describe("validateCashOut", () => {
        beforeEach(() => {
            gameData.ingame = {
                [playerName]: {
                    betTracks: {},
                },
            };
        });

        it("should return false when player has no game data", () => {
            // Arrange
            gameData.ingame = {};

            // Act
            const result = consumer.validateCashOut(realPlayer);

            // Assert
            expect(result).toBeFalsy();
        });

        it("should return false when player has no bet tracks", () => {
            // Arrange
            gameData.ingame[playerName].betTracks = null;

            // Act
            const result = consumer.validateCashOut(realPlayer);

            // Assert
            expect(result).toBeFalsy();
        });

        it("should return false when player has no bet", () => {
            // Arrange
            gameData.ingame[playerName].betTracks = {
                // Empty bet tracks
            };

            // Act
            const result = consumer.validateCashOut(realPlayer);

            // Assert
            expect(result).toBeFalsy();
        });

        it("should return false when player has already cashed out", () => {
            // Arrange
            gameData.ingame[playerName].betTracks = {
                [Actions.CashOut]: { time: new Date() },
            };

            // Act
            const result = consumer.validateCashOut(realPlayer);

            // Assert
            expect(result).toBeFalsy();
        });

        it("should return true when player has bet and hasn't cashed out", () => {
            // Arrange
            gameData.ingame[playerName].betTracks = {
                [Actions.Bet]: { amount: 100 },
            };

            // Act
            const result = consumer.validateCashOut(realPlayer);

            // Assert
            expect(result).toBeTruthy();
        });
    });

    describe("proceedCashOut", () => {

        beforeEach(() => {
            // Setup basic game data structure
            gameData.ingame = {
                [playerName]: {
                    betTracks: {},
                },
            };

            // Setup exchange rates
            gameData.exchangeRates = {
                code: {
                    USD: 1,
                },
            };

            // Mock baseEventPublisher
            consumer.publisher = {
                publishToUser: jest.fn(),
            };

            // Spy on internal methods
            jest.spyOn(consumer, "validateCashOut");
            jest.spyOn(consumer, "getCashOutBet");
            jest.spyOn(consumer, "insertBetLog");
            jest.spyOn(consumer, "updateGameData");
        });


        describe("when validation fails", () => {
            beforeEach(() => {
                jest.spyOn(consumer.publisher, "publishToUser");
            });

            it("should return null", async () => {
                // Arrange

                consumer.validateCashOut.mockReturnValue(false);

                // Act
                const result = await consumer.proceedCashOut(realPlayer);

                // Assert
                expect(result).toBeNull();
            });

            it("should publish invalid notice", async () => {
                // Arrange

                consumer.validateCashOut.mockReturnValue(false);

                // Act
                await consumer.proceedCashOut(realPlayer);

                // Assert
                expect(consumer.publisher.publishToUser).toHaveBeenCalledTimes(1);
                expect(consumer.publisher.publishToUser).toHaveBeenCalledWith(realPlayer.UID, {
                    endBet: -1,
                    notice: helpers.invalidCashOut,
                });
            });

            it("should not proceed with further processing", async () => {
                // Arrange

                consumer.validateCashOut.mockReturnValue(false);

                // Act
                await consumer.proceedCashOut(realPlayer);

                // Assert
                expect(consumer.insertBetLog).not.toHaveBeenCalled();
                expect(consumer.updateGameData).not.toHaveBeenCalled();
            });
        });

        describe("when validation succeeds", () => {
            let betDetails;

            beforeEach(() => {
                // Create betDetails once and reuse it
                betDetails = {
                    multiplier: 1.5,
                    roundId: chance.natural(),
                    tapCount: 1,
                    amount: 100,
                    multiplierMode: 1,
                };

                // Setup for successful validation scenario
                consumer.validateCashOut.mockReturnValue(true);
                consumer.getCashOutBet.mockReturnValue(betDetails);
                consumer.insertBetLog.mockResolvedValue();
                consumer.updateGameData.mockResolvedValue();
                consumer.settleGameRoundConsumer.settleRound.mockResolvedValue(150);
            });

            it("should return player with bet details", async () => {
                // Arrange

                // Act
                const result = await consumer.proceedCashOut(realPlayer);

                // Assert
                expect(result).toEqual({
                    player: realPlayer,
                    multiplier: betDetails.multiplier,
                    roundId: betDetails.roundId,
                    tapCount: betDetails.tapCount,
                    amount: betDetails.amount,
                });
            });

            it("should insert bet log with correct details", async () => {
                // Arrange
                // Act
                await consumer.proceedCashOut(realPlayer);

                // Assert
                expect(consumer.insertBetLog).toHaveBeenCalledTimes(1);
                expect(consumer.insertBetLog).toHaveBeenCalledWith(realPlayer, betDetails.roundId, { ...betDetails, isAutoCashOut: false });
            });

            it("should update game data", async () => {
                // Arrange

                // Act
                await consumer.proceedCashOut(realPlayer);

                // Assert
                expect(consumer.updateGameData).toHaveBeenCalledTimes(1);
                expect(consumer.updateGameData).toHaveBeenCalledWith(realPlayer, {
                    multiplier: betDetails.multiplier,
                    roundId: betDetails.roundId,
                    tapCount: betDetails.tapCount,
                    multiplierMode: betDetails.multiplierMode,
                });
            });

            describe("and has big win", () => {
                it("should publish recent big win with correct params", async () => {
                    // Arrange
                    betDetails.multiplier = 2;
                    consumer.recentBigWinPublisher.publish = jest.fn();
                    consumer.calculateCurrencyRate = jest.fn().mockReturnValue(1.0);
                    consumer.settleGameRoundConsumer.settleRound = jest.fn().mockResolvedValue(100);
                    roundMultiplier.mockReturnValue(200);

                    const recentBigWinningWinner = {
                        name: realPlayer.profile.name,
                        amount: betDetails.amount,
                        baseAmount: 200,
                        winningAmount: 200,
                        baseWinningAmount: 200,
                        multiplier: betDetails.multiplier,
                        rate: 1.0,
                        time: new Date(),
                        exchangeRateId: gameData.exchangeRates.exId,
                    };
                    consumer.bigWinConsumer.add = jest.fn().mockReturnValue(recentBigWinningWinner);

                    // Act
                    await consumer.proceedCashOut(realPlayer);

                    // Assert
                    expect(consumer.recentBigWinPublisher.publish).toHaveBeenCalledTimes(1);
                    expect(consumer.recentBigWinPublisher.publish).toHaveBeenCalledWith(recentBigWinningWinner);
                });
            });

            describe("and not has big win", () => {
                it("should not publish recent big win", async () => {
                    // Arrange
                    consumer.recentBigWinPublisher.publish = jest.fn();

                    // Act
                    await consumer.proceedCashOut(realPlayer);

                    // Assert
                    expect(consumer.recentBigWinPublisher.publish).not.toHaveBeenCalled();
                });
            });
        });

        describe("when getCashOutBet returns null", () => {
            it("should return null without further processing", async () => {
                // Arrange
                consumer.validateCashOut.mockReturnValue(true);
                consumer.getCashOutBet.mockReturnValue(null);

                // Act
                const result = await consumer.proceedCashOut(realPlayer);

                // Assert
                expect(result).toBeNull();
                expect(consumer.insertBetLog).not.toHaveBeenCalled();
                expect(consumer.updateGameData).not.toHaveBeenCalled();
            });
        });
    });

    describe("getCashOutBet", () => {
        beforeEach(() => {
            gameData.ingame = {
                [playerName]: {
                    betTracks: {},
                },
            };
        });

        it("should return null when no bet exists", () => {
            // Act
            const result = consumer.getCashOutBet(realPlayer);

            // Assert
            expect(result).toBeNull();
        });

        it("should return bet details when bet exists", () => {
            // Arrange
            const expectedBet = {
                multiplier: 1.5,
                roundId: 123,
                tapCount: 1,
                amount: 100,
            };

            gameData.ingame[playerName].activeBet = {
                ...expectedBet,
                currentMultiplier: expectedBet.multiplier,
            };
            // Act
            const result = consumer.getCashOutBet(realPlayer);

            // Assert
            expect(result).toEqual(expectedBet);
        });
    });
});
