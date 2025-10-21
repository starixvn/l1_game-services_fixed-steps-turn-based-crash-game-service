import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { Core } from "sc-game-base";
import { GameDefinition } from "sc-game-base/src/core";
import { ProvablyFairConsumer, UnsettledRoundConsumer } from "sc-game-base/src/core/event-consumers";
import { GameStatusPublisher, RunningRoundInfoPublisher } from "sc-game-base/src/core/event-publishers";
import { SettleCashOutConsumer } from "../../consumers/settle-cash-out-consumer";
import { SettleGameRoundConsumer } from "../../consumers/settle-game-round-consumer";
import CrashGameData from "../../game-data";
import gameSettings from "../../game-settings";
import UmInfoWatcher from "../../watchers/um-info-watcher";
import Bot from "../bot";
import GameCrons from "../game-crons";

jest.mock("sc-game-base/src/core/event-publishers");
jest.mock("../../consumers/settle-game-round-consumer");
jest.mock("../../consumers/settle-cash-out-consumer");
jest.mock("../../helpers/crash-point-helper", () => ({
    //calculateCrashTimeInMillisecond: jest.fn().mockReturnValue(1000),
}));
jest.mock("../../watchers/um-info-watcher");

/** @type {mongoose.Model}*/
const userInfosRepository = stubMongoose(mongoose.Model);
userInfosRepository.updateMany = jest.fn();

const { durations } = gameSettings;
const gameData = new CrashGameData(3);
const definition = new GameDefinition({ id: 1, name: "game name", durations }, jest.fn, jest.fn, jest.fn);
const bot = new Bot(gameData, definition, null, userInfosRepository);
const settleGameRoundConsumer = new SettleGameRoundConsumer({});
const runningRoundInfoPublisher = new RunningRoundInfoPublisher();
const gameStatusPublisher = new GameStatusPublisher();
const umInfoWatcher = new UmInfoWatcher(gameData);
const unsettledRoundConsumer = stub(UnsettledRoundConsumer);
const provablyFairConsumer = stub(ProvablyFairConsumer);
const settleCashOutConsumer = new SettleCashOutConsumer({});

/** @type {logger}*/
const logService = {
    logError: jest.fn(),
};

/** @type {mongoose.Model}*/
const gameConfigsRepository = stubMongoose(mongoose.Model);
gameConfigsRepository.updateOne = jest.fn();

/** @type {mongoose.Model}*/
const roundsRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const notificationRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const archiveRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const exchangeRatesRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const currencyGroupGamesRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const partnerConfigRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const currencyGroupRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const currencyRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const betsRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const betLogsRepository = stubMongoose(mongoose.Model);

const roundResultConsumer = { generateServerSeedAndPublishHash: jest.fn(), generateResult: jest.fn() };

const createBaseGameCron = function () {
    return new GameCrons({
        definition,
        gameData: { ...gameData },
        bot,
        settleGameRoundConsumer,
        gameStatusPublisher,
        runningRoundInfoPublisher,
        logService,
        gameConfigsRepository,
        roundsRepository,
        archiveStatusesRepository: archiveRepository,
        notificationRepository,
        exchangeRatesRepository,
        currencyGroupGamesRepository,
        partnerConfigRepository,
        currencyGroupRepository,
        currencyRepository,
        roundResultConsumer,
        betsRepository,
        betLogsRepository,
        resultsRepository: {},
        promotionRepository: {},
        appConfigs: {},
        umInfoWatcher,
        unsettledRoundConsumer,
        provablyFairConsumer,
        settleCashOutConsumer,
    });
};

/** @type {GameCrons}*/
let cron;

describe("GameCrons", () => {
    beforeEach(() => {
        cron = createBaseGameCron();

        cron.checkGameStatus = jest.fn();
        cron.resetForNewRound = jest.fn();
        cron.updatePromotionOddsAndNotify = jest.fn();
        cron.isStartingTime = jest.fn();
        cron.gameData.disabled = true;
        cron.bot.reset = jest.fn();
        cron.bot.run = jest.fn();
        cron.bot.cashOut = jest.fn();
        cron.initRoundId = jest.fn();
        cron.queryLastResult = jest.fn();
        cron.getSettingForNewRound = jest.fn();
        cron.updateExchangeRates = jest.fn();
        cron.proceedUnsettledBets = jest.fn();
        cron.startCron = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should inherit Core.Crons.BaseGameCron", () => {
        // Assert
        expect(cron instanceof Core.Crons.BaseGameCron);
    });

    describe("constructor", () => {
        it("should initialize all dependencies correctly", () => {
            expect(cron.betsRepository).toBe(betsRepository);
            expect(cron.betLogsRepository).toBe(betLogsRepository);
            expect(cron.settleCashOutConsumer).toBe(settleCashOutConsumer);
        });
    });

    describe("start", () => {
        it("should call all required initialization methods", async () => {
            // Act
            await cron.start();

            // Assert
            expect(cron.initRoundId).toHaveBeenCalled();
            expect(cron.queryLastResult).toHaveBeenCalled();
            expect(cron.getSettingForNewRound).toHaveBeenCalled();
            expect(cron.updateExchangeRates).toHaveBeenCalled();
            expect(cron.proceedUnsettledBets).toHaveBeenCalled();
            expect(cron.startCron).toHaveBeenCalled();
        });
    });

    describe("proceed", () => {
        beforeEach(() => {
            cron.gameData.disabled = false;
            cron.gameData.remainingTime = 60;
        });

        it("should reset bot and check game status when remaining time equals whole round", async () => {
            // Arrange
            cron.gameData.remainingTime = durations.wholeRound;
            cron.bot.reset.mockResolvedValue();

            // Act
            await cron.proceed();

            // Assert
            expect(cron.bot.reset).toHaveBeenCalled();
            expect(cron.checkGameStatus).toHaveBeenCalled();
        });

        it("should not reset bot when bot is not available", async () => {
            // Arrange
            cron.gameData.remainingTime = durations.wholeRound;
            cron.bot = null;

            // Act
            await cron.proceed();

            // Assert
            expect(cron.checkGameStatus).toHaveBeenCalled();
        });

        it("should decrement remaining time when game is not disabled", async () => {
            // Arrange
            cron.gameData.remainingTime = 50;

            // Act
            await cron.proceed();

            // Assert
            expect(cron.gameData.remainingTime).toBe(49);
        });

        it("should not decrement remaining time when game is disabled", async () => {
            // Arrange
            cron.gameData.disabled = true;
            cron.gameData.remainingTime = 50;

            // Act
            await cron.proceed();

            // Assert
            expect(cron.gameData.remainingTime).toBe(50);
        });

        it("should run bot when game is not disabled and bot is available", async () => {
            // Arrange
            cron.bot.run.mockResolvedValue();

            // Act
            await cron.proceed();

            // Assert
            expect(cron.bot.run).toHaveBeenCalled();
        });

        it("should not run bot when bot is not available", async () => {
            // Arrange
            cron.bot = null;

            // Act
            await cron.proceed();

            // Assert
            expect(cron.gameData.remainingTime).toBe(59);
        });

        it("should reset remaining time to whole round when it becomes negative", async () => {
            // Arrange
            cron.gameData.remainingTime = -1;

            // Act
            await cron.proceed();

            // Assert
            expect(cron.gameData.remainingTime).toBe(durations.wholeRound);
        });
    });


    describe("proceedUnsettledBets", () => {
        const mockUnsettledBets = [
            {
                id: "round-1",
                uid: "player-1",
                name: "player1",
                amount: 100,
                paid: false,
                multiplierMode: 2
            },
            {
                id: "round-2", 
                uid: "player-2",
                name: "player2",
                amount: 200,
                paid: false,
                multiplierMode: 3
            }
        ];

        const mockBetLogs = [
            {
                siteId: "site-1",
                currency: "USD",
                operatorId: "op-1",
                playerId: "player-1",
                rate: 1.0,
                currencyMultiplier: 1.0,
                currencyCode: "USD",
                multiplier: 2.5
            }
        ];

        beforeEach(() => {
            // Create a fresh cron instance for proceedUnsettledBets tests
            cron = createBaseGameCron();
            
            roundsRepository.find.mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue(mockUnsettledBets)
                })
            });

            betLogsRepository.find.mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue(mockBetLogs)
                })
            });

            settleCashOutConsumer.proceedCashOut = jest.fn().mockResolvedValue();
        });

        it("should query unsettled bets from roundsRepository", async () => {
            // Act
            await cron.proceedUnsettledBets();

            // Assert
            expect(roundsRepository.find).toHaveBeenCalledWith({ paid: false });
            expect(roundsRepository.find().lean).toHaveBeenCalled();
            expect(roundsRepository.find().lean().exec).toHaveBeenCalled();
        });

        it("should query bet logs for each unsettled round", async () => {
            // Act
            await cron.proceedUnsettledBets();

            // Assert
            expect(betLogsRepository.find).toHaveBeenCalledWith(
                { roundId: "round-1" },
                { _id: false },
                { sort: { time: -1 } }
            );
            expect(betLogsRepository.find().lean).toHaveBeenCalled();
            expect(betLogsRepository.find().lean().exec).toHaveBeenCalled();
        });

        it("should create player object with correct structure", async () => {
            // Act
            await cron.proceedUnsettledBets();

            // Assert
            expect(cron.gameData.ingame.player1).toEqual({
                activeBet: {
                    roundId: "round-1",
                    tapCount: 1,
                    currentMultiplier: 2.5,
                    amount: 100,
                    multiplierMode: 2
                }
            });
        });

        it("should call settleCashOutConsumer for each player", async () => {
            // Act
            await cron.proceedUnsettledBets();

            // Assert
            expect(settleCashOutConsumer.proceedCashOut).toHaveBeenCalledWith(
                {
                    UID: "player-1",
                    profile: { name: "player1" },
                    session: {
                        siteId: "site-1",
                        currencyName: "USD",
                        currencyCode: "USD",
                        multiplier: 1.0,
                        operatorId: "op-1",
                        playerId: "player-1",
                        rate: 1.0
                    }
                },
                true
            );
        });

        it("should handle multiple unsettled bets", async () => {
            // Arrange
            const multipleBets = [
                { id: "round-1", uid: "player-1", name: "player1", amount: 100, paid: false, multiplierMode: 1 },
                { id: "round-2", uid: "player-2", name: "player2", amount: 200, paid: false, multiplierMode: 4 }
            ];
            
            roundsRepository.find.mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue(multipleBets)
                })
            });

            // Act
            await cron.proceedUnsettledBets();

            // Assert
            expect(settleCashOutConsumer.proceedCashOut).toHaveBeenCalledTimes(2);
        });

        it("should handle empty unsettled bets", async () => {
            // Arrange
            roundsRepository.find.mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue([])
                })
            });

            // Act
            await cron.proceedUnsettledBets();

            // Assert
            expect(settleCashOutConsumer.proceedCashOut).not.toHaveBeenCalled();
        });

        it("should handle bet logs with multiple entries", async () => {
            // Arrange
            const multipleBetLogs = [
                { siteId: "site-1", currency: "USD", operatorId: "op-1", playerId: "player-1", rate: 1.0, currencyMultiplier: 1.0, currencyCode: "USD", multiplier: 2.5 },
                { siteId: "site-1", currency: "USD", operatorId: "op-1", playerId: "player-1", rate: 1.0, currencyMultiplier: 1.0, currencyCode: "USD", multiplier: 3.0 }
            ];
            
            betLogsRepository.find.mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue(multipleBetLogs)
                })
            });

            // Act
            await cron.proceedUnsettledBets();

            // Assert
            expect(cron.gameData.ingame.player1.activeBet.tapCount).toBe(2);
        });

        it("should extract correct data from bet logs", async () => {
            // Arrange
            const betLogsWithData = [
                {
                    siteId: "site-123",
                    currency: "EUR",
                    operatorId: "op-456",
                    playerId: "player-789",
                    rate: 0.85,
                    currencyMultiplier: 1.2,
                    currencyCode: "EUR",
                    multiplier: 1.5
                }
            ];
            
            betLogsRepository.find.mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue(betLogsWithData)
                })
            });

            // Act
            await cron.proceedUnsettledBets();

            // Assert
            expect(cron.gameData.ingame.player1.activeBet.currentMultiplier).toBe(1.5);
            expect(settleCashOutConsumer.proceedCashOut).toHaveBeenCalledWith(
                expect.objectContaining({
                    session: expect.objectContaining({
                        siteId: "site-123",
                        currencyName: "EUR",
                        currencyCode: "EUR",
                        operatorId: "op-456",
                        playerId: "player-789",
                        rate: 0.85,
                        multiplier: 1.2
                    })
                }),
                true
            );
        });
    });

});