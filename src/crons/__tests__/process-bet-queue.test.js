import Chance from "chance";
import { stub, stubMongoose } from "jest-micro-auto-stub";
import { cloneDeep } from "lodash";
import mongoose from "mongoose";
import logger from "sc-common/logger";
import { GameDefinition } from "sc-game-base/src/core";
import BaseMetrics from "sc-game-base/src/core/base-metrics";
import { ProvablyFairConsumer } from "sc-game-base/src/core/event-consumers";
import { PlaceBetPublisher } from "sc-game-base/src/core/event-publishers";
import { Actions } from "../../constants";
import { MineConsumer, RecentBetConsumer, SettleCashOutConsumer } from "../../consumers";
import { RecentBetPublisher } from "../../event-publishers";
import CrashGameData from "../../game-data";
import noticeHelper from "../../helpers/notice-helper";
import ProcessBetQueue from "../process-bet-queue";

const chance = new Chance();

jest.mock("../../helpers/crash-point-helper", () => ({
    getNextMultiplier: jest.fn(),
}));

xdescribe("ProcessBetQueue", () => {
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
        crashConfig: {
            fixedStepsMultiplierConfigs: [
                {
                    mode: 1,
                    multiplierSteps: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
                },
                {
                    mode: 2,
                    multiplierSteps: [2.0, 2.2, 2.4, 2.6, 2.8, 3.0, 3.2, 3.4, 3.6, 3.8, 4.0, 4.2, 4.4, 4.6, 4.8, 5.0],
                },
            ],
            maxWinPerRound: 1000,
        },
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
    const mineConsumer = stub(MineConsumer);
    const roundResultConsumer = stub();
    const recentBetConsumer = stub(RecentBetConsumer);
    const recentBetPublisher = stub(RecentBetPublisher);
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

    /** @type {mongoose.Model}*/
    const roundsRepository = {
        create: jest.fn(),
        findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn() }) }),
    };

    const baseMetrics = stub(BaseMetrics);
    let player = null,
        placeBet = null;
    /** @type {ProcessBetQueue}*/
    let proceedBetQueue = null;

    const payload = {
        freeBet: chance.bool(),
        amount: chance.natural(),
        action: chance.pickone(Object.values(Actions)),
        roundId: gameData.roundId,
        receivedTime: new Date(),
        time: new Date(),
        clientSeed: "9000",
        multiplierMode: 1,
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

    describe("Constructor", () => {
        it("should initialize with correct dependencies", () => {
            // Arrange
            const processBetQueue = new ProcessBetQueue({
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
                roundResultConsumer,
                roundsRepository,
                mineConsumer,
                recentBetConsumer,
                recentBetPublisher,
            });

            // Assert
            expect(processBetQueue.settleCashOutConsumer).toBe(settleCashOutConsumer);
            expect(processBetQueue.provablyFairConsumer).toBe(provablyFairConsumer);
            expect(processBetQueue.roundResultConsumer).toBe(roundResultConsumer);
            expect(processBetQueue.roundsRepository).toBe(roundsRepository);
            expect(processBetQueue.mineConsumer).toBe(mineConsumer);
            expect(processBetQueue.recentBetConsumer).toBe(recentBetConsumer);
            expect(processBetQueue.recentBetPublisher).toBe(recentBetPublisher);
        });
    });

    describe("dequeueBets", () => {
        beforeEach(() => {
            proceedBetQueue.proceedActions = jest.fn();
        });

        it("should not call proceedActions when gameData.ingame is undefined", () => {
            // Arrange
            gameData.ingame = undefined;

            // Act
            proceedBetQueue.dequeueBets();

            // Assert
            expect(proceedBetQueue.proceedActions).not.toHaveBeenCalled();
        });

        it("should not call proceedActions when gameData.ingame is empty", () => {
            // Arrange
            gameData.ingame = {};

            // Act
            proceedBetQueue.dequeueBets();

            // Assert
            expect(proceedBetQueue.proceedActions).not.toHaveBeenCalled();
        });

        it("should not call proceedActions when playerInGame.betProcessing is true", () => {
            // Arrange
            gameData.ingame.player01.betProcessing = true;

            // Act
            proceedBetQueue.dequeueBets();

            // Assert
            expect(proceedBetQueue.proceedActions).not.toHaveBeenCalled();
        });

        it("should not call proceedActions when playerInGame.betQueue is undefined", () => {
            // Arrange
            gameData.ingame.player01.betQueue = undefined;

            // Act
            proceedBetQueue.dequeueBets();

            // Assert
            expect(proceedBetQueue.proceedActions).not.toHaveBeenCalled();
        });

        it("should not call proceedActions when playerInGame.betQueue is empty", () => {
            // Arrange
            gameData.ingame.player01.betQueue = [];

            // Act
            proceedBetQueue.dequeueBets();

            // Assert
            expect(proceedBetQueue.proceedActions).not.toHaveBeenCalled();
        });

        it("should call proceedActions when conditions are met", () => {
            // Arrange
            proceedBetQueue.proceedActions = jest.fn().mockResolvedValueOnce({});

            // Act
            proceedBetQueue.dequeueBets();

            // Assert
            expect(proceedBetQueue.proceedActions).toHaveBeenCalledWith({}, {});
        });

        it("should update playerInGame.betProcessing to true", () => {
            // Arrange
            proceedBetQueue.proceedActions = jest.fn().mockResolvedValueOnce({});

            // Act
            proceedBetQueue.dequeueBets();

            // Assert
            expect(gameData.ingame.player01.betProcessing).toBeTruthy();
        });
    });

    describe("validateBetRequest", () => {
        it("should return false when player has active bet", async () => {
            // Arrange
            const playerName = player.profile.name;
            gameData.ingame[playerName].activeBet = { amount: 100 };

            // Act
            const result = await proceedBetQueue.validateBetRequest(player, payload);

            // Assert
            expect(result).toBe(false);
        });

        it("should publish game failed bet when player has active bet", async () => {
            // Arrange
            const playerName = player.profile.name;
            gameData.ingame[playerName].activeBet = { amount: 100 };

            // Act
            await proceedBetQueue.validateBetRequest(player, payload);

            // Assert
            expect(proceedBetQueue.placeBetPublisher.publishGameFailedBet).toHaveBeenCalledWith(player.UID, {
                endBet: -1,
                notice: { errorCode: noticeHelper.cannotPlaceBet },
            });
        });

        it("should return true when player has no active bet", async () => {
            // Arrange
            const playerName = player.profile.name;
            gameData.ingame[playerName].activeBet = null;

            // Act
            const result = await proceedBetQueue.validateBetRequest(player, payload);

            // Assert
            expect(result).toBe(true);
        });
    });

    describe("proceedActions", () => {
        beforeEach(() => {
            proceedBetQueue.proceedBet = jest.fn();
            proceedBetQueue.proceedMine = jest.fn();
        });

        it("should call proceedBet when action is Bet", async () => {
            // Arrange
            const betPayload = { ...payload, action: Actions.Bet };

            // Act
            await proceedBetQueue.proceedActions(player, betPayload);

            // Assert
            expect(proceedBetQueue.proceedBet).toHaveBeenCalledWith(player, betPayload.bet);
        });

        it("should call proceedMine when action is Mine", async () => {
            // Arrange
            const minePayload = { ...payload, action: Actions.Mine };

            // Act
            await proceedBetQueue.proceedActions(player, minePayload);

            // Assert
            expect(proceedBetQueue.proceedMine).toHaveBeenCalledWith(player, minePayload);
        });

        it("should call settleCashOutConsumer.proceedCashOut when action is CashOut", async () => {
            // Arrange
            const cashOutPayload = { ...payload, action: Actions.CashOut };

            // Act
            await proceedBetQueue.proceedActions(player, cashOutPayload);

            // Assert
            expect(proceedBetQueue.settleCashOutConsumer.proceedCashOut).toHaveBeenCalledWith(player);
        });
    });

    describe("composeBettingTimeValidationCriteria", () => {
        it("should return empty array", () => {
            // Act
            const result = proceedBetQueue.composeBettingTimeValidationCriteria(roundId);

            // Assert
            expect(result).toEqual([]);
        });
    });

    describe("handleSuccessBet", () => {
        const player = {
                session: {
                    currencyGroupId: "test-group",
                },
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
            proceedBetQueue.insertBetLog = jest.fn();
            proceedBetQueue.notifyPlacingBetResult = jest.fn();
            proceedBetQueue.updateUserStakeLevel = jest.fn();
            proceedBetQueue.getMaxWinPerRound = jest.fn().mockReturnValue(1000);
            recentBetConsumer.add = jest.fn().mockResolvedValue({
                name: player.profile.name,
                amount: payload.amount,
                baseAmount: payload.amount * rate,
                rate,
            });
            recentBetPublisher.publish = jest.fn();
            gameData.provablyFair = {
                [player.profile.name]: {
                    finalResult: 2.5,
                },
            };
            gameData.ingame = {
                [player.profile.name]: {},
            };
            gameData.addPlayerToBetList = jest.fn();
        });

        it("should call calculateCurrencyRate", async () => {
            // Act
            await proceedBetQueue.handleSuccessBet(player, balance, roundId, payload);

            // Assert
            expect(proceedBetQueue.calculateCurrencyRate).toHaveBeenCalledWith(player.session);
        });

        it("should call provablyFairConsumer.generateCrashPoint", async () => {
            // Act
            await proceedBetQueue.handleSuccessBet(player, balance, roundId, payload);

            // Assert
            expect(proceedBetQueue.provablyFairConsumer.generateCrashPoint).toHaveBeenCalledWith(
                player.profile.name,
                payload.clientSeed,
                roundId
            );
        });

        it("should call provablyFairConsumer.createResultRecord", async () => {
            // Act
            await proceedBetQueue.handleSuccessBet(player, balance, roundId, payload);

            // Assert
            expect(proceedBetQueue.provablyFairConsumer.createResultRecord).toHaveBeenCalledWith(player.profile.name, roundId);
        });

        it("should call insertBet", async () => {
            // Act
            await proceedBetQueue.handleSuccessBet(player, balance, roundId, payload);

            // Assert
            expect(proceedBetQueue.insertBet).toHaveBeenCalledWith(player, roundId, payload, rate, 1.0);
        });

        it("should call insertBetLog", async () => {
            // Act
            await proceedBetQueue.handleSuccessBet(player, balance, roundId, payload);

            // Assert
            expect(proceedBetQueue.insertBetLog).toHaveBeenCalledWith(player, roundId, payload, 1.0);
        });

        it("should set activeBet in gameData", async () => {
            // Act
            await proceedBetQueue.handleSuccessBet(player, balance, roundId, payload);

            // Assert
            expect(gameData.ingame[player.profile.name].activeBet).toEqual({
                ...payload,
                currentMultiplier: 1.0,
                tapCount: 1,
                maxWin: 1000,
            });
        });

        it("should call notifyPlacingBetResult", async () => {
            // Act
            await proceedBetQueue.handleSuccessBet(player, balance, roundId, payload);

            // Assert
            expect(proceedBetQueue.notifyPlacingBetResult).toHaveBeenCalledWith(player, balance, payload, rate, roundId);
        });

        it("should add player to bet list", async () => {
            // Act
            await proceedBetQueue.handleSuccessBet(player, balance, roundId, payload);

            // Assert
            expect(gameData.addPlayerToBetList).toHaveBeenCalledWith(player.UID, {
                name: player.profile.name,
                amount: payload.amount,
                rate,
            });
        });

        it("should not call updateUserStakeLevel when bet is free bet", async () => {
            // Act
            await proceedBetQueue.handleSuccessBet(player, balance, roundId, { ...payload, freeBet: true });

            // Assert
            expect(proceedBetQueue.updateUserStakeLevel).not.toHaveBeenCalled();
        });

        it("should not call updateUserStakeLevel when stake level is unchanged", async () => {
            // Arrange
            const res = {
                minBet: player.profile.minBet,
                maxBet: player.profile.maxBet,
            };

            // Act
            await proceedBetQueue.handleSuccessBet(player, res, roundId, { ...payload, freeBet: false });

            // Assert
            expect(proceedBetQueue.updateUserStakeLevel).not.toHaveBeenCalled();
        });

        it("should call updateUserStakeLevel when stake level is changed", async () => {
            // Act
            await proceedBetQueue.handleSuccessBet(player, balance, roundId, { ...payload, freeBet: false });

            // Assert
            expect(proceedBetQueue.updateUserStakeLevel).toHaveBeenCalledWith(player, balance.minBet, balance.maxBet);
        });

        it("should call settleCashOutConsumer when currentMultiplier is 0", async () => {
            // Arrange
            gameData.provablyFair[player.profile.name].finalResult = 0.5;

            // Act
            await proceedBetQueue.handleSuccessBet(player, balance, roundId, payload);

            // Assert
            expect(proceedBetQueue.settleCashOutConsumer.proceedCashOut).toHaveBeenCalledWith(player);
        });

        it("should set currentMultiplier to 0 when finalResult is less than firstMultiplier", async () => {
            // Arrange
            gameData.provablyFair[player.profile.name].finalResult = 0.5; // Less than firstMultiplier (1.0)

            // Act
            await proceedBetQueue.handleSuccessBet(player, balance, roundId, payload);

            // Assert
            expect(gameData.ingame[player.profile.name].activeBet.currentMultiplier).toBe(0);
        });

        it("should set currentMultiplier to firstMultiplier when finalResult is greater than firstMultiplier", async () => {
            // Arrange
            gameData.provablyFair[player.profile.name].finalResult = 1.5; // Greater than firstMultiplier (1.0)

            // Act
            await proceedBetQueue.handleSuccessBet(player, balance, roundId, payload);

            // Assert
            expect(gameData.ingame[player.profile.name].activeBet.currentMultiplier).toBe(1.0);
        });
    });

    describe("generatePlacingBetResult", () => {
        it("should return result with correct multiplier, ownChip amount, winAmount, and user name", () => {
            // Arrange
            const player = mockPlayer();
            const balance = { minBet: 10, maxBet: 1000 };
            const bet = { amount: 100 };
            const rate = 1.0;
            gameData.ingame[player.profile.name] = {
                activeBet: { currentMultiplier: 2.5 },
            };

            // Act
            const result = proceedBetQueue.generatePlacingBetResult(player, balance, bet, rate);

            // Assert
            expect(result.multiplier).toBe(2.5);
            expect(result.ownChip).toEqual({ amount: 100 });
            expect(result.winAmount).toBe(250);
            expect(result.user.name).toBe(player.profile.name);
        });
    });

    describe("insertBetLog", () => {
        it("should create bet log with correct data", async () => {
            // Arrange
            const player = mockPlayer();
            const roundId = chance.natural();
            const bet = { amount: 100, action: "bet", freeBet: false };
            const currentMultiplier = 2.5;
            proceedBetQueue.calculateCurrencyRate = jest.fn().mockReturnValue(1.0);

            // Act
            await proceedBetQueue.insertBetLog(player, roundId, bet, currentMultiplier);

            // Assert
            expect(proceedBetQueue.betLogsRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    uid: player.UID,
                    name: player.profile.name,
                    time: expect.any(Date),
                    action: bet.action,
                    amount: bet.amount,
                    winAmount: 250,
                    freeBet: bet.freeBet,
                    result: bet.result,
                    multiplier: currentMultiplier,
                    clientSendTime: bet.clientSendTime,
                    receivedTime: bet.receivedTime,
                    roundId,
                    tapCount: bet.tapCount,
                    siteId: player.session?.siteId,
                    currency: player.session?.currencyName,
                    currencyMultiplier: player.session?.multiplier,
                    currencyGroupId: player.session?.currencyGroupId,
                    rate: 1.0,
                    currencyCode: player.session?.currencyCode,
                    operatorId: player.session?.operatorId,
                    playerId: player.session?.playerId,
                })
            );
        });

        it("should include session data when player has session", async () => {
            // Arrange
            const player = mockPlayer();
            const roundId = chance.natural();
            const bet = { amount: 100, action: "bet", freeBet: false };
            const currentMultiplier = 2.5;
            proceedBetQueue.calculateCurrencyRate = jest.fn().mockReturnValue(1.0);

            // Act
            await proceedBetQueue.insertBetLog(player, roundId, bet, currentMultiplier);

            // Assert
            expect(proceedBetQueue.betLogsRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    siteId: player.session.siteId,
                    currency: player.session.currencyName,
                    operatorId: player.session.operatorId,
                    playerId: player.session.playerId,
                    currencyMultiplier: player.session.multiplier,
                    currencyGroupId: player.session.currencyGroupId,
                    rate: 1,
                    currencyCode: player.session.currencyCode,
                })
            );
        });
    });

    describe("insertBet", () => {
        beforeEach(() => {
            proceedBetQueue.getMaxWinPerRound = jest.fn().mockReturnValue(1000);
        });

        it("should create bet with correct data", async () => {
            // Arrange
            const player = mockPlayer();
            const roundId = chance.natural();
            const bet = { amount: 100, freeBet: false, clientSeed: "123", autoCashOut: 2.0 };
            const rate = 1.0;
            const currentMultiplier = 2.5;
            proceedBetQueue.getMaxWinPerRound = jest.fn().mockReturnValue(1000);

            // Act
            await proceedBetQueue.insertBet(player, roundId, bet, rate, currentMultiplier);

            // Assert
            expect(proceedBetQueue.roundsRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    uid: player.UID,
                    name: player.profile.name,
                    time: expect.any(Date),
                    freeBet: bet.freeBet,
                    id: roundId,
                    amount: bet.amount,
                    autoCashOut: bet.autoCashOut,
                    clientSeed: bet.clientSeed,
                    totalAmount: bet.amount,
                    odds: gameData.gameConfigs.crashConfig.fixedStepsMultiplierConfigs,
                    exchangeRateId: gameData.exchangeRates.exId,
                    multiplier: currentMultiplier,
                    tapCount: 1,
                    maxWin: 1000,
                })
            );
        });

        it("should include session data when player has session", async () => {
            // Arrange
            const player = mockPlayer();
            const roundId = chance.natural();
            const bet = { amount: 100, freeBet: false, clientSeed: "123", autoCashOut: 2.0 };
            const rate = 1.0;
            const currentMultiplier = 2.5;

            // Act
            await proceedBetQueue.insertBet(player, roundId, bet, rate, currentMultiplier);

            // Assert
            expect(proceedBetQueue.roundsRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    siteId: player.session.siteId,
                    currency: player.session.currencyName,
                    rate: rate,
                    operatorId: player.session.operatorId,
                    playerId: player.session.playerId,
                })
            );
        });
    });

    describe("decreaseBetTracks", () => {
        it("should delete bet track when player exists in gameData", () => {
            // Arrange
            const playerName = "player01";
            gameData.ingame[playerName] = {
                betTracks: { [Actions.Bet]: 100 },
            };

            // Act
            proceedBetQueue.decreaseBetTracks(playerName);

            // Assert
            expect(gameData.ingame[playerName].betTracks[Actions.Bet]).toBeUndefined();
        });

        it("should not throw error when player does not exist in gameData", () => {
            // Arrange
            const playerName = "nonexistent";

            // Act & Assert
            expect(() => proceedBetQueue.decreaseBetTracks(playerName)).not.toThrow();
        });
    });

    describe("proceedMine", () => {
        it("should call mineConsumer.mine when player has bet track", async () => {
            // Arrange
            const player = mockPlayer();
            const payload = { action: "mine" };
            gameData.ingame[player.profile.name] = {
                betTracks: { [Actions.Bet]: 100 },
            };

            // Act
            await proceedBetQueue.proceedMine(player, payload);

            // Assert
            expect(proceedBetQueue.mineConsumer.mine).toHaveBeenCalledWith(player, payload);
        });

        it("should not call mineConsumer.mine when player has no bet track", async () => {
            // Arrange
            const player = mockPlayer();
            const payload = { action: "mine" };
            gameData.ingame[player.profile.name] = {
                betTracks: {},
            };

            // Act
            await proceedBetQueue.proceedMine(player, payload);

            // Assert
            expect(proceedBetQueue.mineConsumer.mine).not.toHaveBeenCalled();
        });
    });

    describe("notifyPlacingBetResult", () => {
        it("should call generatePlacingBetResult and publishSuccessBet", () => {
            // Arrange
            const player = mockPlayer();
            const balance = { minBet: 10, maxBet: 1000 };
            const bet = { amount: 100 };
            const rate = 1.0;
            const roundId = chance.natural();
            proceedBetQueue.generatePlacingBetResult = jest.fn().mockReturnValue({ multiplier: 2.5 });

            // Act
            proceedBetQueue.notifyPlacingBetResult(player, balance, bet, rate, roundId);

            // Assert
            expect(proceedBetQueue.generatePlacingBetResult).toHaveBeenCalledWith(player, balance, bet, rate);
        });

        it("should call publishSuccessBet with correct parameters", () => {
            // Arrange
            const player = mockPlayer();
            const balance = { minBet: 10, maxBet: 1000 };
            const bet = { amount: 100 };
            const rate = 1.0;
            const roundId = chance.natural();
            const mockResult = { multiplier: 2.5 };
            proceedBetQueue.generatePlacingBetResult = jest.fn().mockReturnValue(mockResult);

            // Act
            proceedBetQueue.notifyPlacingBetResult(player, balance, bet, rate, roundId);

            // Assert
            expect(proceedBetQueue.placeBetPublisher.publishSuccessBet).toHaveBeenCalledWith(player.UID, { ...mockResult, roundId });
        });
    });

    describe("getMaxWinPerRound", () => {
        beforeEach(() => {
            gameData.gameConfigs.crashConfig.maxWinPerRound = 1000;
        });

        it("should return calculated max win based on player settings", () => {
            // Arrange
            const player = mockPlayer();
            player.profile.maxBet = 500;
            gameData.currencyGroupGames = [
                {
                    groupId: player.session.currencyGroupId,
                    maxBet: 1000,
                },
            ];

            // Act
            const result = proceedBetQueue.getMaxWinPerRound(player);

            // Assert
            expect(result).toBe(500000); // maxWinPerRound (1000) * min(maxBet, settings.maxBet) (500)
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
            roundResultConsumer,
            roundsRepository,
            mineConsumer,
            recentBetConsumer,
            recentBetPublisher,
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
});
