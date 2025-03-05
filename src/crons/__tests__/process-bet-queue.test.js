import Chance from "chance";
import { stub, stubMongoose } from "jest-micro-auto-stub";
import { cloneDeep } from "lodash";
import mongoose from "mongoose";
import logger from "sc-common/logger";
import { GameDefinition } from "sc-game-base/src/core";
import BaseMetrics from "sc-game-base/src/core/base-metrics";
import { PlaceBetPublisher } from "sc-game-base/src/core/event-publishers";
import { ProvablyFairConsumer } from "sc-game-base/src/core/event-consumers";
import { Actions } from "../../constants";
import { SettleCashOutConsumer } from "../../consumers";
import CrashGameData from "../../game-data";
import { calculateMultiplier } from "../../helpers/crash-point-helper";
import noticeHelper from "../../helpers/notice-helper";
import ProcessBetQueue from "../process-bet-queue";

const chance = new Chance();

jest.mock("../../helpers/crash-point-helper", () => ({
    calculateMultiplier: jest.fn(),
}));

describe("ProcessBetQueue", () => {
    jest.mock("sc-game-base/src/core/event-publishers");
    const roundId = chance.natural();
    const gameData = new CrashGameData(10);
    gameData.exchangeRates = {
        exId: 1,
        code: {
            USD: 1,
            VND: 0.00004405,
            IDR: 0.07099,
        },
    };

    gameData.startTime = new Date();

    gameData.gameConfigs = {
        crashConfig: {},
    };

    gameData.currencies = [
        { code: "USD", name: "USD", isTest: false, isUncountOnTotal: false },
        { code: "IND", name: "IND", isTest: true, isUncountOnTotal: false },
        { code: "VND", name: "UUS", isTest: true, isUncountOnTotal: true },
    ];

    const definition = new GameDefinition({
        id: 1,
        name: "game name",
        durations: {
            wholeRound: 36,
            placingBets: 30,
            lockingBet: 5,
            shakeThePlateDuration: 1,
        },
        choicesMapper: { red2: 1 },
    });
    const placeBetPublisher = stub(PlaceBetPublisher);
    const settleCashOutConsumer = stub(SettleCashOutConsumer);
    const provablyFairConsumer = stub(ProvablyFairConsumer);
    /** @type {logger}*/
    const logService = stub(logger);
    /** @type {mongoose.Model}*/
    const betsRepository = {
        create: jest.fn(),
        findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn() }) }),
    };
    /** @type {mongoose.Model}*/
    const betLogsRepository = {
        find: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn() }) }),
        create: jest.fn(),
        findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn() }) }),
    };

    /** @type {mongoose.Model}*/
    const userInfosRepository = stubMongoose(mongoose.Model);
    userInfosRepository.updateOne = jest.fn();

    const baseMetrics = stub(BaseMetrics);
    let player = null,
        proceedBetQueue = null,
        placeBet = null;

    const payload = {
        freeBet: chance.bool(),
        amount: chance.natural(),
        action: chance.pickone(Object.values(Actions)),
        roundId: gameData.roundId,
        receivedTime: new Date(),
        time: new Date(),
        clientSeed: "9000",
    };
    beforeEach(() => {
        const playerInGameData = {
            name: "player01",
            betTracks: { red2: 100 },
            betQueue: [
                {
                    player: {},
                    payload: {},
                },
            ],
        };
        player = mockPlayer();
        placeBet = jest.fn();
        proceedBetQueue = initBetQueue(placeBet);

        gameData.ingame = {
            player01: cloneDeep(playerInGameData),
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    describe("dequeueBets", () => {
        beforeEach(() => {
            proceedBetQueue.proceedActions = jest.fn();
        });

        describe("when gameData.inGame is undefined", () => {
            it("should not call proceedActions", () => {
                // Arrange
                gameData.ingame = undefined;

                // Act
                proceedBetQueue.dequeueBets();

                // Assert
                expect(proceedBetQueue.proceedActions).not.toBeCalled();
            });
        });

        describe("when gameData.inGame is empty", () => {
            it("should not call proceedActions", () => {
                // Arrange
                gameData.ingame = {};

                // Act
                proceedBetQueue.dequeueBets();

                // Assert
                expect(proceedBetQueue.proceedActions).not.toBeCalled();
            });
        });

        describe("when gameData.inGame is not empty", () => {
            describe("when playerInGame.betProcessing is true", () => {
                it("should not call proceedActions", () => {
                    // Arrange
                    gameData.ingame.player01.betProcessing = true;

                    // Act
                    proceedBetQueue.dequeueBets();

                    // Assert
                    expect(proceedBetQueue.proceedActions).not.toBeCalled();
                });
            });

            describe("when playerInGame.betQueue is undefined", () => {
                it("should not call proceedActions", () => {
                    // Arrange
                    gameData.ingame.player01.betQueue = undefined;

                    // Act
                    proceedBetQueue.dequeueBets();

                    // Assert
                    expect(proceedBetQueue.proceedActions).not.toBeCalled();
                });
            });

            describe("when playerInGame.betQueue is empty", () => {
                it("should not call proceedActions", () => {
                    // Arrange
                    gameData.ingame.player01.betQueue = [];

                    // Act
                    proceedBetQueue.dequeueBets();

                    // Assert
                    expect(proceedBetQueue.proceedActions).not.toBeCalled();
                });
            });

            describe("when playerInGame.betProcessing is false and betQueue is not empty", () => {
                it("should call proceedActions", () => {
                    // Arrange
                    proceedBetQueue.proceedActions = jest.fn().mockResolvedValueOnce({});

                    // Act
                    proceedBetQueue.dequeueBets();

                    // Assert
                    expect(proceedBetQueue.proceedActions).toBeCalledWith({}, {});
                });

                it("should update playerInGame.processingBet to true", () => {
                    // Arrange
                    proceedBetQueue.proceedActions = jest.fn().mockResolvedValueOnce({});

                    // Act
                    proceedBetQueue.dequeueBets();

                    // Assert
                    expect(gameData.ingame.player01.betProcessing).toBeTruthy();
                });
            });
        });
    });

    describe("proceedActions", () => {
        beforeEach(() => {
            proceedBetQueue.proceedBet = jest.fn();
            proceedBetQueue.proceedCashOut = jest.fn();
            betLogsRepository.find().lean().exec.mockResolvedValueOnce([]);
        });

        describe("when action is bet", () => {
            it("should call proceedBet", async () => {
                // Arrange
                const betPayload = { ...payload, action: Actions.Bet };

                // Act
                await proceedBetQueue.proceedActions(player, betPayload);

                // Assert
                expect(proceedBetQueue.proceedBet).toBeCalledWith(player, betPayload);
            });
        });

        describe("when action is cashOut", () => {
            it("should call proceedCashOut", async () => {
                // Arrange
                const cashOutPayload = { ...payload, action: Actions.CashOut };

                // Act
                await proceedBetQueue.proceedActions(player, cashOutPayload);

                // Assert
                expect(proceedBetQueue.proceedCashOut).toBeCalledWith(player, cashOutPayload);
            });
        });
    });

    describe("proceedCashOut", () => {
        beforeEach(() => {
            betLogsRepository.find().lean().exec.mockReturnValueOnce([]);
        });

        it("should find current round bet", async () => {
            // Act
            await proceedBetQueue.proceedCashOut(player, payload);

            // Assert
            expect(betsRepository.findOne).toBeCalledWith({ uid: player.UID, roundId: gameData.roundId, freeBet: payload.freeBet });
        });

        describe("when NOT exist bet", () => {
            it("should publishGameFailedBet", async () => {
                // Act
                await proceedBetQueue.proceedCashOut(player, payload);

                // Assert
                expect(proceedBetQueue.placeBetPublisher.publishGameFailedBet).toBeCalledWith(player.UID, {
                    endBet: -1,
                    notice: { errorCode: noticeHelper.invalidCashOut },
                });
            });
        });

        describe("when existing bet", () => {
            const bet = { receivedTime: new Date(), amount: chance.natural() };
            const currentMultiplier = chance.floating({ min: 2, max: 100 });

            beforeEach(() => {
                betsRepository.findOne().lean().exec.mockResolvedValueOnce(bet);
                proceedBetQueue.isCashOutHalfAmount = jest.fn();
                proceedBetQueue.publishCashOutFailed = jest.fn();
                proceedBetQueue.getMaxWinPerRound = jest.fn();

                // Mock calculateCashOutMultiplier
                proceedBetQueue.calculateCashOutMultiplier = jest.fn().mockReturnValue(currentMultiplier);

                // Set up player in gameData.ingame with currentMultiplier
                gameData.ingame = {
                    [player.profile.name]: {
                        currentMultiplier,
                    },
                };
            });

            it("should get current multiplier from gameData", async () => {
                // Act
                await proceedBetQueue.proceedCashOut(player, {
                    ...payload,
                    player: {
                        profile: { name: player.profile.name },
                    },
                });

                // Assert
                expect(proceedBetQueue.calculateCashOutMultiplier).toBeCalledWith(
                    expect.objectContaining({
                        player: {
                            profile: { name: player.profile.name },
                        },
                    })
                );
            });

            // ... rest of the tests ...
        });
    });

    describe("handleSuccessBet", () => {
        const player = {
                session: chance.guid(),
                profile: {
                    minBet: chance.natural(),
                    maxBet: chance.natural(),
                    name: "player",
                },
            },
            balance = {
                minBet: chance.natural(),
                maxBet: chance.natural(),
            },
            roundId = chance.natural(),
            rate = chance.floating({ min: 1 });

        beforeEach(() => {
            proceedBetQueue.calculateCurrencyRate = jest.fn().mockReturnValueOnce(rate);
            proceedBetQueue.insertBet = jest.fn();
            proceedBetQueue.notifyPlacingBetResult = jest.fn();
            proceedBetQueue.updateUserStakeLevel = jest.fn();
        });

        it("should call calculateCurrencyRate", async () => {
            // Act
            await proceedBetQueue.handleSuccessBet(player, balance, roundId, payload);

            // Assert
            expect(proceedBetQueue.calculateCurrencyRate).toBeCalledWith(player.session);
        });

        it("should call insertBet", async () => {
            // Act
            await proceedBetQueue.handleSuccessBet(player, balance, roundId, payload);

            // Assert
            expect(proceedBetQueue.insertBet).toBeCalledWith(player, roundId, payload, rate);
        });

        it("should call notifyPlacingBetResult", async () => {
            // Act
            await proceedBetQueue.handleSuccessBet(player, balance, roundId, payload);

            // Assert
            expect(proceedBetQueue.notifyPlacingBetResult).toBeCalledWith(player, balance, payload, rate);
        });

        describe("when bet is free bet", () => {
            it("should not call updateUserStakeLevel", async () => {
                // Act
                await proceedBetQueue.handleSuccessBet(player, balance, roundId, { ...payload, freeBet: true });

                // Assert
                expect(proceedBetQueue.updateUserStakeLevel).not.toBeCalled();
            });
        });

        describe("when bet is not free bet and user stake level is not updated", () => {
            it("should not call updateUserStakeLevel", async () => {
                // Arrange
                const res = {
                    minBet: player.profile.minBet,
                    maxBet: player.profile.maxBet,
                };

                // Act
                await proceedBetQueue.handleSuccessBet(player, res, roundId, { ...payload, freeBet: false });

                // Assert
                expect(proceedBetQueue.updateUserStakeLevel).not.toBeCalled();
            });
        });

        describe("when bet is not free bet and user stake level is updated", () => {
            it("should call updateUserStakeLevel", async () => {
                // Act
                await proceedBetQueue.handleSuccessBet(player, balance, roundId, { ...payload, freeBet: false });

                // Assert
                expect(proceedBetQueue.updateUserStakeLevel).toBeCalledWith(player, balance.minBet, balance.maxBet);
            });
        });
    });

    describe("insertBet", () => {
        const mockDate = new Date();

        beforeEach(() => {
            jest.spyOn(global, "Date").mockImplementation(() => mockDate);
        });

        it("should call betsRepository.create", async () => {
            // Arrange
            const rate = chance.floating({ min: 1 });

            const expectResult = {
                uid: player.UID,
                name: player.profile.name,
                time: mockDate,
                freeBet: payload.freeBet,
                roundId,
                amount: payload.amount,
                siteId: player.session.siteId,
                currency: player.session.currencyName,
                rate: rate,
                operatorId: player.session.operatorId,
                playerId: player.session.playerId,
                clientSeed: payload.clientSeed,
                autoCashOut: payload.autoCashOut,
                totalAmount: payload.amount,
            };

            // Act
            await proceedBetQueue.insertBet(player, roundId, payload, rate);

            // Assert
            expect(proceedBetQueue.betsRepository.create).toBeCalledWith(expectResult);
        });
    });

    const initBetQueue = (placeBet) => {
        return new ProcessBetQueue({
            definition,
            gameData,
            placeBetPublisher,
            placeBet,
            logService,
            betsRepository,
            betLogsRepository,
            userInfosRepository,
            baseMetrics,
            settleCashOutConsumer,
            provablyFairConsumer,
        });
    };

    const mockPlayer = () => {
        return {
            UID: 1,
            profile: { name: "player01", minBet: 1, maxBet: 5000 },
            session: {
                userId: 1,
                playerId: 1,
                siteId: "123456",
                currencyCode: "USD",
                currencyName: "USD",
                multiplier: 1000,
                currencyGroupId: chance.guid(),
            },
            socketClient: {
                emit: jest.fn(),
            },
        };
    };

    describe("validateCashOut", () => {
        const multiplier = chance.floating({ min: 1, max: 10 });
        const bet = { roundId: gameData.roundId };
        const betLogs = [];

        beforeEach(() => {
            proceedBetQueue.publishCashOutFailed = jest.fn();
        });

        it("should return true when cashout is valid", () => {
            // Arrange
            gameData.result = multiplier + 1;

            // Act
            const result = proceedBetQueue.validateCashOut(multiplier, bet, player, betLogs);

            // Assert
            expect(result).toBeTruthy();
            expect(proceedBetQueue.publishCashOutFailed).not.toBeCalled();
        });

        it("should return false and publish failed when cashout is invalid", () => {
            // Arrange
            gameData.result = multiplier;

            // Act
            const result = proceedBetQueue.validateCashOut(multiplier, bet, player, betLogs);

            // Assert
            expect(result).toBeFalsy();
            expect(proceedBetQueue.publishCashOutFailed).toBeCalledWith(player);
        });
    });

    describe("isInvalidCashOut", () => {
        const multiplier = chance.floating({ min: 1, max: 10 });
        const result = multiplier + 1;
        const bet = { roundId: gameData.roundId };
        const cashOutBetLogs = null;

        it("should return true when bet is null", () => {
            // Act
            const isInvalid = proceedBetQueue.isInvalidCashOut(null, multiplier, result, gameData.roundId, cashOutBetLogs);

            // Assert
            expect(isInvalid).toBeTruthy();
        });

        it("should return true when multiplier is greater than or equal to result", () => {
            // Act
            const isInvalid = proceedBetQueue.isInvalidCashOut(bet, result, result, gameData.roundId, cashOutBetLogs);

            // Assert
            expect(isInvalid).toBeTruthy();
        });

        it("should return true when roundId does not match", () => {
            // Act
            const isInvalid = proceedBetQueue.isInvalidCashOut(bet, multiplier, result, gameData.roundId + 1, cashOutBetLogs);

            // Assert
            expect(isInvalid).toBeTruthy();
        });

        it("should return true when cashOutBetLogs exists", () => {
            // Act
            const isInvalid = proceedBetQueue.isInvalidCashOut(bet, multiplier, result, gameData.roundId, { action: Actions.CashOut });

            // Assert
            expect(isInvalid).toBeTruthy();
        });

        it("should return false when all conditions are valid", () => {
            // Act
            const isInvalid = proceedBetQueue.isInvalidCashOut(bet, multiplier, result, gameData.roundId, cashOutBetLogs);

            // Assert
            expect(isInvalid).toBeFalsy();
        });
    });
});
