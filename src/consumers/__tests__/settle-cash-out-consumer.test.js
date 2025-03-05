import mongoose from "mongoose";
import { stub, stubMongoose } from "jest-micro-auto-stub";
import GameData from "../../game-data";
import PlaceBetPublisher from "../../event-publishers/place-bet-publisher";
import { SettleCashOutConsumer } from "../settle-cash-out-consumer";
import { Actions } from "../../constants";
import Chance from "chance";
import helpers from "../../helpers/notice-helper";

const chance = new Chance();

jest.mock("../../helpers/date-helper", () => ({
    addMillisecond: jest.fn(),
}));

describe("SettleCashOutConsumer", () => {
    const gameData = new GameData();
    gameData.updatePlayerAction = jest.fn();
    gameData.gameConfigs.crashConfig = {};
    gameData.result = 100;

    const placeBetPublisher = stub(PlaceBetPublisher);
    const logService = {
        logError: jest.fn(),
    };
    const betLogsRepository = stubMongoose(mongoose.Model);

    let consumer;

    beforeEach(() => {
        consumer = new SettleCashOutConsumer(gameData, placeBetPublisher, logService, betLogsRepository);
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
        const payload = { roundId, action: Actions.CashOut, tapCount: 1 };

        beforeEach(() => {
            consumer.calculateCurrencyRate = jest.fn();
        });

        it("should call calculateCurrencyRate", async () => {
            // Act
            await consumer.insertBetLog(realPlayer, roundId, payload);

            // Assert
            expect(consumer.calculateCurrencyRate).toBeCalledWith(realPlayer.session);
        });

        it("should call betLogsRepository.create", async () => {
            // Arrange
            const rate = chance.floating({ min: 1 });
            const mockDate = new Date();
            jest.spyOn(global, "Date").mockReturnValueOnce(mockDate);
            consumer.calculateCurrencyRate.mockReturnValueOnce(rate);

            // Act
            await consumer.insertBetLog(realPlayer, roundId, payload);

            // Assert
            expect(betLogsRepository.create).toBeCalledWith({
                uid: realPlayer.UID,
                name: realPlayer.profile.name,
                time: mockDate,
                action: payload.action,
                amount: payload.amount,
                clientSendTime: payload.clientSendTime,
                receivedTime: payload.receivedTime,
                roundId,
                multiplier: payload.multiplier,
                siteId: realPlayer.session.siteId,
                currency: realPlayer.session.currencyName,
                rate,
                operatorId: realPlayer.session.operatorId,
                playerId: realPlayer.session.playerId,
                tapCount: payload.tapCount,
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
                [Actions.Bet]: { amount: 100 },
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
        const setupValidBetDetails = () => ({
            multiplier: 1.5,
            roundId: chance.natural(),
            tapCount: 1,
            amount: 100,
        });

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
            consumer.baseEventPublisher = {
                publishToUser: jest.fn(),
            };

            // Spy on internal methods
            jest.spyOn(consumer, "validateCashOut");
            jest.spyOn(consumer, "getCashOutBet");
            jest.spyOn(consumer, "insertBetLog");
            jest.spyOn(consumer, "updateGameData");
        });

        const setupSuccessfulCashOut = (betDetails = setupValidBetDetails()) => {
            consumer.validateCashOut.mockReturnValue(true);
            consumer.getCashOutBet.mockResolvedValue(betDetails);
            return betDetails;
        };

        describe("when validation fails", () => {
            it("should return null", async () => {
                // Arrange
                const payload = { action: Actions.CashOut };
                consumer.validateCashOut.mockReturnValue(false);

                // Act
                const result = await consumer.proceedCashOut(realPlayer, payload);

                // Assert
                expect(result).toBeNull();
            });

            it("should publish invalid notice", async () => {
                // Arrange
                const payload = { action: Actions.CashOut };
                consumer.validateCashOut.mockReturnValue(false);

                // Act
                await consumer.proceedCashOut(realPlayer, payload);

                // Assert
                expect(consumer.baseEventPublisher.publishToUser).toHaveBeenCalledTimes(1);
                expect(consumer.baseEventPublisher.publishToUser).toHaveBeenCalledWith(realPlayer.UID, {
                    endBet: -1,
                    notice: helpers.invalidCashOut,
                });
            });

            it("should not proceed with further processing", async () => {
                // Arrange
                const payload = { action: Actions.CashOut };
                consumer.validateCashOut.mockReturnValue(false);

                // Act
                await consumer.proceedCashOut(realPlayer, payload);

                // Assert
                expect(consumer.getCashOutBet).not.toHaveBeenCalled();
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
                };

                // Setup for successful validation scenario
                consumer.validateCashOut.mockReturnValue(true);
                consumer.getCashOutBet.mockReturnValue(betDetails);
                consumer.insertBetLog.mockResolvedValue();
                consumer.updateGameData.mockResolvedValue();
            });

            it("should return player with bet details", async () => {
                // Arrange
                const payload = { action: Actions.CashOut };

                // Act
                const result = await consumer.proceedCashOut(realPlayer, payload);

                // Assert
                expect(result).toEqual({
                    player: realPlayer,
                    ...betDetails,
                });
            });

            it("should insert bet log with correct details", async () => {
                // Arrange
                const payload = { action: Actions.CashOut };

                // Act
                await consumer.proceedCashOut(realPlayer, payload);

                // Assert
                expect(consumer.insertBetLog).toHaveBeenCalledTimes(1);
                expect(consumer.insertBetLog).toHaveBeenCalledWith(realPlayer, betDetails.roundId, betDetails);
            });

            it("should update game data", async () => {
                // Arrange
                const payload = { action: Actions.CashOut };

                // Act
                await consumer.proceedCashOut(realPlayer, payload);

                // Assert
                expect(consumer.updateGameData).toHaveBeenCalledTimes(1);
                expect(consumer.updateGameData).toHaveBeenCalledWith(realPlayer, {
                    multiplier: betDetails.multiplier,
                    roundId: betDetails.roundId,
                    tapCount: betDetails.tapCount,
                });
            });
        });

        describe("when getCashOutBet returns null", () => {
            it("should return null without further processing", async () => {
                // Arrange
                const payload = { action: Actions.CashOut };
                consumer.validateCashOut.mockReturnValue(true);
                consumer.getCashOutBet.mockReturnValue(null);

                // Act
                const result = await consumer.proceedCashOut(realPlayer, payload);

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
            gameData.ingame[playerName].betTracks = {
                [Actions.Bet]: expectedBet,
            };

            // Act
            const result = consumer.getCashOutBet(realPlayer);

            // Assert
            expect(result).toEqual(expectedBet);
        });
    });

    describe("publishCashOut", () => {
        beforeEach(() => {
            consumer.placeBetPublisher = {
                publishSuccessCashOut: jest.fn(),
            };
            consumer.calculateCurrencyRate = jest.fn().mockReturnValue(1.0);
        });

        it("should publish cash out details correctly", async () => {
            // Arrange
            const payload = { action: Actions.CashOut };
            const winningDetails = {
                multiplier: 1.5,
                amount: 100,
            };

            // Act
            await consumer.publishCashOut(realPlayer, payload, winningDetails);

            // Assert
            expect(consumer.placeBetPublisher.publishSuccessCashOut).toHaveBeenCalledWith(
                realPlayer.UID,
                {
                    name: realPlayer.profile.name,
                    playerId: realPlayer.UID,
                    [payload.action]: winningDetails,
                },
                1.0
            );
        });
    });
});
