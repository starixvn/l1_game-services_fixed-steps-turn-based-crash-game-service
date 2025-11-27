import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { Core } from "sc-game-base";
import { GameDefinition } from "sc-game-base/src/core";
import { ProvablyFairConsumer } from "sc-game-base/src/core/event-consumers";
import { GameStatusPublisher, RunningRoundInfoPublisher } from "sc-game-base/src/core/event-publishers";
import { SettleCashOutConsumer } from "../../consumers/settle-cash-out-consumer";
import { SettleGameRoundConsumer } from "../../consumers/settle-game-round-consumer";
import { UnsettledRoundConsumer } from "../../consumers/unsettled-round-consumer";
import CrashGameData from "../../game-data";
import gameSettings from "../../game-settings";
import UmInfoWatcher from "../../watchers/um-info-watcher";
import Bot from "../bot";
import GameCrons from "../game-crons";

jest.mock("sc-game-base/src/core/event-publishers");
jest.mock("../../consumers/settle-game-round-consumer");
jest.mock("../../consumers/settle-cash-out-consumer");
jest.mock("../../consumers/unsettled-round-consumer");
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
        cron.getSettingForNewRound = jest.fn();
        cron.updateExchangeRates = jest.fn();
        cron.startCron = jest.fn();
        cron.getLastArchiveRound = jest.fn();
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
            // Arrange
            unsettledRoundConsumer.proceed = jest.fn().mockResolvedValue();

            // Act
            await cron.start();

            // Assert
            expect(cron.initRoundId).toHaveBeenCalled();
            expect(cron.getSettingForNewRound).toHaveBeenCalled();
            expect(cron.updateExchangeRates).toHaveBeenCalled();
            expect(unsettledRoundConsumer.proceed).toHaveBeenCalled();
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

    describe("initRoundId", () => {
        beforeEach(() => {
            cron.initRoundId = GameCrons.prototype.initRoundId.bind(cron);
        });

        it("should set roundId to lastRound.id + 100 when lastRound exists", async () => {
            // Arrange
            const lastRoundId = 12345;
            const mockQuery = {
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue({ id: lastRoundId })
            };
            roundsRepository.findOne.mockReturnValue(mockQuery);

            // Act
            await cron.initRoundId();

            // Assert
            expect(cron.gameData.roundId).toBe(lastRoundId + 100);
            expect(roundsRepository.findOne).toHaveBeenCalledWith({}, "id", { sort: { id: -1 } });
        });

        it("should set roundId to archivedRoundId + 100 when no lastRound exists", async () => {
            // Arrange
            const archivedRoundId = 54321;
            const mockQuery = {
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(null)
            };
            roundsRepository.findOne.mockReturnValue(mockQuery);
            cron.getLastArchiveRound.mockResolvedValue(archivedRoundId);

            // Act
            await cron.initRoundId();

            // Assert
            expect(cron.gameData.roundId).toBe(archivedRoundId + 100);
            expect(roundsRepository.findOne).toHaveBeenCalledWith({}, "id", { sort: { id: -1 } });
            expect(cron.getLastArchiveRound).toHaveBeenCalled();
        });
    });

});