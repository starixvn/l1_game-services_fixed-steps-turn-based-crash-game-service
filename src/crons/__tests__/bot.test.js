import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { BaseEventPublisher } from "sc-game-base/src/core/event-publishers";
import { TableGameDefinition } from "sc-game-base/src/table";
import { ProvablyFairConsumer } from "sc-game-base/src/core/event-consumers";
import CrashGameData from "../../game-data";
import gameSettings from "../../game-settings";
import { calculateMultiplier } from "../../helpers/crash-point-helper";
import Bot from "../bot";

jest.mock("sc-game-base/src/core/event-publishers/base-event-publisher");
jest.mock("../../helpers/crash-point-helper", () => ({
    calculateMultiplier: jest.fn(),
}));
const tempBetsRepository = stubMongoose(mongoose.Model);
const tempBetLogsRepository = stubMongoose(mongoose.Model);
tempBetLogsRepository.create = jest.fn();
const provablyFairConsumer = stub(ProvablyFairConsumer);
const userInfosRepository = stubMongoose(mongoose.Model);
const publisher = new BaseEventPublisher();
const definition = new TableGameDefinition(gameSettings);
let gameData = new CrashGameData();

function initBot() {
    return new Bot(definition, gameData, publisher, userInfosRepository, tempBetsRepository, tempBetLogsRepository, provablyFairConsumer);
}

afterEach(() => {
    jest.clearAllMocks();
    gameData = new CrashGameData();
});

describe.skip("getRemovalBotIds", () => {
    const bot = initBot();
    describe("when there are not bots in the room", () => {
        it("should return an empty array", () => {
            const botIds = bot.getRemovalBotIds(3);
            expect(botIds).toBeEmpty();
        });
    });

    describe("when all bots have bet", () => {
        it("should return an empty array", () => {
            bot.botsInRoom = {
                1: { totalBet: 10 },
                2: { totalBet: 20 },
                3: { totalBet: 30 },
            };
            const botIds = bot.getRemovalBotIds(2);
            expect(botIds).toBeEmpty();
        });
    });

    describe("when totalRemoval < bots in room", () => {
        it("should return an array with length = totalRemoval", () => {
            bot.botsInRoom = {
                1: { totalBet: 0, remainTickets: 1 },
                2: { totalBet: 0, remainTickets: 1 },
                3: { totalBet: 0, remainTickets: 1 },
            };
            const botIds = bot.getRemovalBotIds(2);
            expect(botIds).toHaveLength(2);
        });
    });
    describe("when totalRemoval >= bots in room", () => {
        it("should return all bot ids", () => {
            bot.botsInRoom = {
                1: { totalBet: 0, remainTickets: 1 },
                2: { totalBet: 0, remainTickets: 1 },
                3: { totalBet: 0, remainTickets: 1 },
            };
            const botIds = bot.getRemovalBotIds(4);
            expect(botIds).toHaveLength(3);
        });
    });
});

describe.skip("getBotsToCashOut", () => {
    describe("when there are no bots in the room", () => {
        it("should return an empty array", () => {
            //Arrange
            const bot = initBot();
            bot.gameData.startTime = new Date(new Date() - 4000);
            calculateMultiplier.mockReturnValueOnce(3);

            //Act
            const botsToCashOut = bot.getBotsToCashOut();

            //Assert
            expect(botsToCashOut).toBeEmpty();
        });
    });
    describe("when all bots have cashed out", () => {
        it("should return an empty array", () => {
            //Arrange
            const bot = initBot();
            calculateMultiplier.mockReturnValueOnce(3);
            bot.gameData.startTime = new Date(new Date() - 4000);
            bot.botsInRoom = {
                1: {
                    totalBet: 100,
                    cashOut: true,
                    multiplier: 2,
                },
                2: {
                    totalBet: 200,
                    cashOut: true,
                    multiplier: 3,
                },
                3: {
                    totalBet: 300,
                    cashOut: true,
                    multiplier: 2.5,
                },
            };

            //Act
            const botsToCashOut = bot.getBotsToCashOut();

            //Assert
            expect(botsToCashOut).toBeEmpty();
        });
    });

    describe("when bot expect cashOut valid", () => {
        it("should return the correct number of bots to cash out ", () => {
            //Arrange
            const multiplier = 1.5;
            const bot = initBot();
            bot.gameData.startTime = new Date(new Date() - 4000);

            bot.botsInRoom = {
                1: { totalBet: 1, cashOut: false, expectCashOut: 1.4 },
                2: { totalBet: 2, cashOut: false, expectCashOut: 12 },
                3: { totalBet: 2, cashOut: false, expectCashOut: 1.6 },
                4: { totalBet: 2, cashOut: false, expectCashOut: 4 },
                5: { totalBet: 2, cashOut: false, expectCashOut: 3 },
            };

            bot.chance = {
                pickset: jest.fn().mockReturnValue([bot.botsInRoom[1]]),
                integer: jest.fn().mockReturnValue(1),
            };
            //Act
            const result = bot.getBotsToCashOut(multiplier);

            //Assert
            expect(result).toContain(bot.botsInRoom[1]);
        });
    });
});

describe.skip("placeBet", () => {
    describe("when the remaining time is less than the locking bet duration", () => {
        it("should not place a bet ", async () => {
            const bot = initBot();
            bot.gameData.gameConfigs = { bot_maxbet: 100 };

            await bot.placeBet({ id: 1, totalBet: 0 });

            expect(userInfosRepository.findOneAndUpdate).not.toBeCalled();
            expect(tempBetsRepository.create).not.toBeCalled();
        });
    });

    it("should place a bet when the bot has enough red balance", async () => {
        //Arrange
        const bot = initBot();
        bot.gameData.gameConfigs = { bot_maxbet: 100 };
        bot.gameData.remainingTime = 12;
        userInfosRepository.findOneAndUpdate.mockReturnValueOnce({ red: 1000 });
        const selectedBot = { totalBet: 1, cashOut: false, id: 1, name: "bot" };
        bot.gameData.players[selectedBot.id] = selectedBot;
        //Act
        await bot.placeBet(selectedBot);

        //Assert
        expect(userInfosRepository.findOneAndUpdate).toBeCalled();
        expect(tempBetsRepository.create).toBeCalled();
    });
});

describe.skip("cashOut", () => {
    describe("when remaining time < 0", () => {
        it("should insert betlog and mark cashout for bots", async () => {
            //Arrange
            const bot = initBot();
            bot.gameData.startTime = new Date(new Date() - 4000);
            bot.gameData.result = 100;
            bot.gameData.remainingTime = -4;
            gameData.betList = {
                1: {},
                2: {},
            };

            bot.botsInRoom = {
                1: { id: 1, nam: "bot1", totalBet: 1, cashOut: false },
                2: { id: 2, nam: "bot2", totalBet: 2, cashOut: false },
                3: { id: 3, nam: "bot3", totalBet: 2, cashOut: false },
                4: { id: 4, nam: "bot4", totalBet: 2, cashOut: false },
                5: { id: 5, nam: "bot5", totalBet: 2, cashOut: false },
            };

            bot.getBotsToCashOut = jest.fn().mockReturnValue([bot.botsInRoom[1], bot.botsInRoom[2]]);
            calculateMultiplier.mockReturnValueOnce(5);
            //Act
            await bot.cashOut();

            //Assert
            expect(tempBetLogsRepository.create).toHaveBeenCalled();
            expect(bot.botsInRoom[1].halfCashOut || bot.botsInRoom[1].cashOut).toEqual(true);
        });

        it("should call publisher.publishToAllUsersExceptSystem", async () => {
            //Arrange
            const bot = initBot();
            bot.gameData.startTime = new Date(new Date() - 4000);
            bot.gameData.result = 100;
            bot.gameData.remainingTime = -4;
            gameData.betList = {
                1: {},
                2: {},
            };

            bot.botsInRoom = {
                1: { id: 1, nam: "bot1", totalBet: 1, cashOut: false },
                2: { id: 2, nam: "bot2", totalBet: 2, cashOut: false },
                3: { id: 3, nam: "bot3", totalBet: 2, cashOut: false },
                4: { id: 4, nam: "bot4", totalBet: 2, cashOut: false },
                5: { id: 5, nam: "bot5", totalBet: 2, cashOut: false },
            };

            bot.getBotsToCashOut = jest.fn().mockReturnValue([bot.botsInRoom[1], bot.botsInRoom[2]]);
            calculateMultiplier.mockReturnValueOnce(5);
            //Act
            await bot.cashOut();

            //Assert
            expect(publisher.publishToAllUsersExceptSystem).toHaveBeenCalled();
        });
    });
});
