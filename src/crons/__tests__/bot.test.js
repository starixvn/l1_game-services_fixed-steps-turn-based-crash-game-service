import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { BaseEventPublisher } from "sc-game-base/src/core/event-publishers";
import { TableGameDefinition } from "sc-game-base/src/table";
import { RecentBetConsumer } from "../../consumers";
import { RecentBetPublisher } from "../../event-publishers";
import CrashGameData from "../../game-data";
import gameSettings from "../../game-settings";
import Bot from "../bot";
jest.mock("sc-game-base/src/core/event-publishers/base-event-publisher");
jest.mock("../../helpers/crash-point-helper", () => ({
    getNextMultiplier: jest.fn(),
}));
jest.mock("../../helpers/number-helper", () => ({
    roundMultiplier: jest.fn(),
}));
jest.mock("../../consumers", () => ({
    RecentBetConsumer: jest.fn(),
}));
jest.mock("../../event-publishers", () => ({
    RecentBetPublisher: jest.fn(),
}));

const userInfosRepository = stubMongoose(mongoose.Model);
const publisher = new BaseEventPublisher();
const definition = new TableGameDefinition(gameSettings);
let gameData = new CrashGameData();
const recentBetConsumer = stub(RecentBetConsumer);
const recentBetPublisher = stub(RecentBetPublisher);

const fixedStepsMultiplierConfigs = [
    {
        mode: 1,
        multiplierSteps: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
    },
    {
        mode: 2,
        multiplierSteps: [2.0, 2.2, 2.4, 2.6, 2.8, 3.0, 3.2, 3.4, 3.6, 3.8, 4.0, 4.2, 4.4, 4.6, 4.8, 5.0],
    },
    {
        mode: 3,
        multiplierSteps: [3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0],
    },
    {
        mode: 4,
        multiplierSteps: [4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0],
    },
];

gameData.gameConfigs = {
    crashConfig: {
        fixedStepsMultiplierConfigs,
    },
};

function initBot() {
    return new Bot(definition, gameData, publisher, userInfosRepository, recentBetConsumer, recentBetPublisher);
}

afterEach(() => {
    jest.clearAllMocks();
    gameData = new CrashGameData();
    gameData.gameConfigs = {
        crashConfig: {
            fixedStepsMultiplierConfigs,
        },
    };
});
describe("GameBots", () => {
    describe("GameBot Constructor", () => {
        it("should initialize with correct dependencies", () => {
            // Arrange
            const bot = initBot();

            // Assert
            expect(bot.definition).toBe(definition);
            expect(bot.gameData).toBe(gameData);
            expect(bot.publisher).toBe(publisher);
            expect(bot.userInfosRepository).toBe(userInfosRepository);
            expect(bot.activeBots).toBeInstanceOf(Map);
            expect(bot.minBotsAtTheTable).toBe(4);
            expect(bot.maxBotsAtTheTable).toBe(8);
            expect(bot.activeTimeouts).toBeInstanceOf(Set);
        });
    });

    describe("run method", () => {
        it("should return early when bots are disabled", async () => {
            // Arrange
            const bot = initBot();
            bot.gameData.gameConfigs = { botenabled: false };
            bot.clearTimeouts = jest.fn();

            // Act
            await bot.run();

            // Assert
            expect(bot.clearTimeouts).not.toHaveBeenCalled();
        });

        it("should clear timeouts when bots are enabled", async () => {
            // Arrange
            const bot = initBot();
            bot.gameData.gameConfigs = { botenabled: true };
            bot.clearTimeouts = jest.fn();
            bot.shouldAddBot = jest.fn().mockReturnValue(false);
            bot.shouldRemoveBot = jest.fn().mockReturnValue(false);
            bot.botsInRoom = {};

            // Act
            await bot.run();

            // Assert
            expect(bot.clearTimeouts).toHaveBeenCalled();
        });

        it("should call shouldAddBot and joinRoom when condition is met", async () => {
            // Arrange
            const bot = initBot();
            bot.gameData.gameConfigs = { botenabled: true };
            bot.clearTimeouts = jest.fn();
            bot.shouldAddBot = jest.fn().mockReturnValue(true);
            bot.shouldRemoveBot = jest.fn().mockReturnValue(false);
            bot.joinRoom = jest.fn().mockResolvedValue();
            bot.botsInRoom = {};

            // Act
            await bot.run();

            // Assert
            expect(bot.shouldAddBot).toHaveBeenCalled();
            expect(bot.joinRoom).toHaveBeenCalled();
        });

        it("should call shouldRemoveBot and leaveRoom when condition is met", async () => {
            // Arrange
            const bot = initBot();
            bot.gameData.gameConfigs = { botenabled: true };
            bot.clearTimeouts = jest.fn();
            bot.shouldAddBot = jest.fn().mockReturnValue(false);
            bot.shouldRemoveBot = jest.fn().mockReturnValue(true);
            bot.leaveRoom = jest.fn().mockResolvedValue();
            bot.botsInRoom = {};

            // Act
            await bot.run();

            // Assert
            expect(bot.shouldRemoveBot).toHaveBeenCalled();
            expect(bot.leaveRoom).toHaveBeenCalled();
        });

        it("should handle bot actions for each bot in room", async () => {
            // Arrange
            jest.useFakeTimers();
            const bot = initBot();
            bot.gameData.gameConfigs = { botenabled: true };
            bot.clearTimeouts = jest.fn();
            bot.shouldAddBot = jest.fn().mockReturnValue(false);
            bot.shouldRemoveBot = jest.fn().mockReturnValue(false);
            bot.handleBotActions = jest.fn().mockResolvedValue();
            bot.botsInRoom = { bot1: {}, bot2: {} };
            bot.chance.integer = jest.fn().mockReturnValue(3);

            // Act
            await bot.run();
            jest.runAllTimers();

            // Assert
            expect(bot.handleBotActions).toHaveBeenCalledTimes(2);
            jest.useRealTimers();
        });
    });

    describe("clearTimeouts method", () => {
        it("should clear all active timeouts", () => {
            // Arrange
            const bot = initBot();
            const timeout1 = setTimeout(() => {}, 100);
            const timeout2 = setTimeout(() => {}, 200);
            bot.activeTimeouts.add(timeout1);
            bot.activeTimeouts.add(timeout2);

            // Act
            bot.clearTimeouts();

            // Assert
            expect(bot.activeTimeouts.size).toBe(0);
        });
    });

    describe("placeBet method", () => {
        it("should increment roundId", async () => {
            // Arrange
            const bot = initBot();
            bot.gameData.roundId = 1;
            bot.getMaxBet = jest.fn().mockReturnValue(100);
            bot.getMinBet = jest.fn().mockReturnValue(10);
            bot.convertAmountToChip = jest.fn().mockReturnValue(50);
            bot.updateBalanceAndPublishBetPayload = jest.fn();
            bot.handleCashout = jest.fn();
            bot.definition.generateResult = jest.fn().mockReturnValue(2.5);
            userInfosRepository.findOneAndUpdate.mockResolvedValue({ red: 1000 });

            // Act
            await bot.placeBet("bot1");

            // Assert
            expect(bot.gameData.roundId).toBe(2);
        });

        it("should get max and min bet amounts", async () => {
            // Arrange
            const bot = initBot();
            bot.botsInRoom = { bot1: { red: 1000 } };
            bot.getMaxBet = jest.fn().mockReturnValue(100);
            bot.getMinBet = jest.fn().mockReturnValue(10);
            bot.convertAmountToChip = jest.fn().mockReturnValue(50);
            bot.updateBalanceAndPublishBetPayload = jest.fn();
            bot.handleCashout = jest.fn();
            bot.definition.generateResult = jest.fn().mockReturnValue(2.5);
            userInfosRepository.findOneAndUpdate.mockResolvedValue({ red: 1000 });

            // Act
            await bot.placeBet("bot1");

            // Assert
            expect(bot.getMaxBet).toHaveBeenCalledWith(bot.botsInRoom["bot1"]);
            expect(bot.getMinBet).toHaveBeenCalled();
        });

        it("should update balance and publish bet payload", async () => {
            // Arrange
            const bot = initBot();
            bot.botsInRoom = { bot1: { red: 1000 } };
            bot.getMaxBet = jest.fn().mockReturnValue(100);
            bot.getMinBet = jest.fn().mockReturnValue(10);
            bot.convertAmountToChip = jest.fn().mockReturnValue(50);
            bot.updateBalanceAndPublishBetPayload = jest.fn();
            bot.handleCashout = jest.fn();
            bot.definition.generateResult = jest.fn().mockReturnValue(2.5);
            bot.chance.integer = jest.fn().mockReturnValue(1); // Mock multiplierMode to 1
            userInfosRepository.findOneAndUpdate.mockResolvedValue({ red: 1000 });

            // Act
            await bot.placeBet("bot1");

            // Assert
            expect(bot.updateBalanceAndPublishBetPayload).toHaveBeenCalledWith("bot1", 1.0, 50, 1000);
        });

        it("should set active bot state", async () => {
            // Arrange
            const bot = initBot();
            bot.botsInRoom = { bot1: { red: 1000 } };
            bot.getMaxBet = jest.fn().mockReturnValue(100);
            bot.getMinBet = jest.fn().mockReturnValue(10);
            bot.convertAmountToChip = jest.fn().mockReturnValue(50);
            bot.updateBalanceAndPublishBetPayload = jest.fn();
            bot.handleCashout = jest.fn();
            bot.definition.generateResult = jest.fn().mockReturnValue(2.5);
            bot.chance.integer = jest.fn().mockReturnValue(1); // Mock multiplierMode to 1
            userInfosRepository.findOneAndUpdate.mockResolvedValue({ red: 1000 });

            // Act
            await bot.placeBet("bot1");

            // Assert
            expect(bot.activeBots.get("bot1")).toEqual({
                amount: 50,
                result: expect.any(Number),
                multiplier: 1.0,
                tapCount: 1,
                lastActionTime: expect.any(Number),
                multiplierMode: 1,
            });
        });

        it("should handle cashout when multiplier is 0", async () => {
            // Arrange
            const bot = initBot();
            bot.botsInRoom = { bot1: { red: 1000 } };
            bot.getMaxBet = jest.fn().mockReturnValue(100);
            bot.getMinBet = jest.fn().mockReturnValue(10);
            bot.convertAmountToChip = jest.fn().mockReturnValue(50);
            bot.updateBalanceAndPublishBetPayload = jest.fn();
            bot.handleCashout = jest.fn();
            userInfosRepository.findOneAndUpdate.mockResolvedValue({ red: 1000 });
            bot.definition.generateResult = jest.fn().mockReturnValue(0.5);

            // Act
            await bot.placeBet("bot1");

            // Assert
            expect(bot.handleCashout).toHaveBeenCalledWith("bot1");
        });

        it("should set multiplier to 0 when result is less than firstMultiplier", async () => {
            // Arrange
            const bot = initBot();
            bot.botsInRoom = { bot1: { red: 1000 } };
            bot.getMaxBet = jest.fn().mockReturnValue(100);
            bot.getMinBet = jest.fn().mockReturnValue(10);
            bot.convertAmountToChip = jest.fn().mockReturnValue(50);
            bot.updateBalanceAndPublishBetPayload = jest.fn();
            bot.handleCashout = jest.fn();
            bot.definition.generateResult = jest.fn().mockReturnValue(0.5); // Less than firstMultiplier (1.0)
            userInfosRepository.findOneAndUpdate.mockResolvedValue({ red: 1000 });

            // Act
            await bot.placeBet("bot1");

            // Assert
            expect(bot.updateBalanceAndPublishBetPayload).toHaveBeenCalledWith("bot1", 0, 50, 1000);
            expect(bot.activeBots.get("bot1").multiplier).toBe(0);
        });

        it("should set multiplier to firstMultiplier when result is greater than firstMultiplier", async () => {
            // Arrange
            const bot = initBot();
            bot.botsInRoom = { bot1: { red: 1000 } };
            bot.getMaxBet = jest.fn().mockReturnValue(100);
            bot.getMinBet = jest.fn().mockReturnValue(10);
            bot.convertAmountToChip = jest.fn().mockReturnValue(50);
            bot.updateBalanceAndPublishBetPayload = jest.fn();
            bot.handleCashout = jest.fn();
            bot.definition.generateResult = jest.fn().mockReturnValue(1.5); // Greater than firstMultiplier (1.0)
            bot.chance.integer = jest.fn().mockReturnValue(1); // Mock multiplierMode to 1
            userInfosRepository.findOneAndUpdate.mockResolvedValue({ red: 1000 });

            // Act
            await bot.placeBet("bot1");

            // Assert
            expect(bot.updateBalanceAndPublishBetPayload).toHaveBeenCalledWith("bot1", 1.0, 50, 1000);
            expect(bot.activeBots.get("bot1").multiplier).toBe(1.0);
        });

        it("should not process bet when user not found", async () => {
            // Arrange
            const bot = initBot();
            bot.botsInRoom = { bot1: { red: 1000 } };
            bot.getMaxBet = jest.fn().mockReturnValue(100);
            bot.getMinBet = jest.fn().mockReturnValue(10);
            bot.convertAmountToChip = jest.fn().mockReturnValue(50);
            bot.updateBalanceAndPublishBetPayload = jest.fn();
            bot.handleCashout = jest.fn();
            userInfosRepository.findOneAndUpdate.mockResolvedValue(null);

            // Act
            await bot.placeBet("bot1");

            // Assert
            expect(bot.updateBalanceAndPublishBetPayload).not.toHaveBeenCalled();
        });
    });

    describe("updateBalanceAndPublishBetPayload method", () => {
        it("should update player balance in gameData", () => {
            // Arrange
            const bot = initBot();
            const botId = "bot1";
            const multiplier = 2.5;
            const amount = 100;
            const balance = 1000;
            bot.gameData.players[botId] = { red: 500 };

            // Act
            bot.updateBalanceAndPublishBetPayload(botId, multiplier, amount, balance);

            // Assert
            expect(bot.gameData.players[botId].red).toBe(balance);
        });

        it("should publish player chip update", () => {
            // Arrange
            const bot = initBot();
            const botId = "bot1";
            const multiplier = 2.5;
            const amount = 100;
            const balance = 1000;

            // Act
            bot.updateBalanceAndPublishBetPayload(botId, multiplier, amount, balance);

            // Assert
            expect(bot.publisher.publishToAllUsersExceptSystem).toHaveBeenCalled();
        });
    });

    describe("handleBotActions method", () => {
        it("should handle Bet action", async () => {
            // Arrange
            const bot = initBot();
            bot.getAction = jest.fn().mockReturnValue("bet");
            bot.placeBet = jest.fn();

            // Act
            await bot.handleBotActions("bot1");

            // Assert
            expect(bot.placeBet).toHaveBeenCalledWith("bot1");
        });

        it("should handle Mine action", async () => {
            // Arrange
            const bot = initBot();
            bot.getAction = jest.fn().mockReturnValue("mine");
            bot.handleMining = jest.fn();

            // Act
            await bot.handleBotActions("bot1");

            // Assert
            expect(bot.handleMining).toHaveBeenCalledWith("bot1");
        });

        it("should handle CashOut action", async () => {
            // Arrange
            const bot = initBot();
            bot.getAction = jest.fn().mockReturnValue("cashOut");
            bot.handleCashout = jest.fn();

            // Act
            await bot.handleBotActions("bot1");

            // Assert
            expect(bot.handleCashout).toHaveBeenCalledWith("bot1");
        });

        it("should handle null action", async () => {
            // Arrange
            const bot = initBot();
            bot.getAction = jest.fn().mockReturnValue(null);
            bot.placeBet = jest.fn();
            bot.handleMining = jest.fn();
            bot.handleCashout = jest.fn();

            // Act
            await bot.handleBotActions("bot1");

            // Assert
            expect(bot.placeBet).not.toHaveBeenCalled();
            expect(bot.handleMining).not.toHaveBeenCalled();
            expect(bot.handleCashout).not.toHaveBeenCalled();
        });
    });

    describe("getRemovalBotIds method", () => {
        it("should return empty array when no bots in room", () => {
            // Arrange
            const bot = initBot();
            bot.botsInRoom = {};

            // Act
            const result = bot.getRemovalBotIds(3);

            // Assert
            expect(result).toEqual([]);
        });

        it("should return bots not in activeBots", () => {
            // Arrange
            const bot = initBot();
            bot.botsInRoom = { bot1: {}, bot2: {}, bot3: {} };
            bot.activeBots.set("bot1", {});
            bot.chance.pickset = jest.fn().mockReturnValue(["bot2", "bot3"]);

            // Act
            const result = bot.getRemovalBotIds(1);

            // Assert
            expect(result).toEqual(["bot2", "bot3"]);
        });

        it("should set removeBotAtTheTable flag when not set", () => {
            // Arrange
            const bot = initBot();
            bot.botsInRoom = { bot1: {}, bot2: {}, bot3: {} };
            bot.removeBotAtTheTable = undefined;
            bot.chance.pickset = jest.fn().mockReturnValue(["bot1"]);

            // Act
            bot.getRemovalBotIds(1);

            // Assert
            expect(bot.removeBotAtTheTable).toBe(true);
        });
    });

    describe("getAction method", () => {
        it("should return Bet action with 30% probability when no bot state", () => {
            // Arrange
            const bot = initBot();
            bot.activeBots.clear();
            bot.chance.bool = jest.fn().mockReturnValue(true);

            // Act
            const result = bot.getAction("bot1");

            // Assert
            expect(result).toBe("bet");
            expect(bot.chance.bool).toHaveBeenCalledWith({ likelihood: 30 });
        });

        it("should return null when no bot state and not betting", () => {
            // Arrange
            const bot = initBot();
            bot.activeBots.clear();
            bot.chance.bool = jest.fn().mockReturnValue(false);

            // Act
            const result = bot.getAction("bot1");

            // Assert
            expect(result).toBe(null);
        });

        it("should use weighted selection when bot state exists", () => {
            // Arrange
            const bot = initBot();
            const botState = { tapCount: 2 };
            bot.activeBots.set("bot1", botState);
            bot.chance.weighted = jest.fn().mockReturnValue("mine");

            // Act
            const result = bot.getAction("bot1");

            // Assert
            expect(bot.chance.weighted).toHaveBeenCalledWith(["mine", "cashOut", null], [73, 2, 29]);
            expect(result).toBe("mine");
        });
    });

    describe("handleMining method", () => {
        it("should get next multiplier and update bot state", async () => {
            // Arrange
            const bot = initBot();
            bot.gameData.gameConfigs = {
                crashConfig: {
                    fixedStepsMultiplierConfigs: [
                        {
                            mode: 1,
                            multiplierSteps: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
                        },
                    ],
                },
            };
            bot.activeBots.set("bot1", {
                multiplier: 1.5,
                result: 3.0,
                tapCount: 1,
                lastActionTime: Date.now(),
                multiplierMode: 1,
            });
            const { getNextMultiplier } = require("../../helpers/crash-point-helper");
            getNextMultiplier.mockReturnValue(1.6);

            // Act
            await bot.handleMining("bot1");

            // Assert
            expect(getNextMultiplier).toHaveBeenCalledWith(1.5, bot.gameData.gameConfigs.crashConfig.fixedStepsMultiplierConfigs[0]);
        });

        it("should set multiplier to 0 when exceeding result", async () => {
            // Arrange
            const bot = initBot();
            bot.gameData.gameConfigs = {
                crashConfig: {
                    fixedStepsMultiplierConfigs: [
                        {
                            mode: 1,
                            multiplierSteps: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
                        },
                    ],
                },
            };
            const botState = {
                multiplier: 1.5,
                result: 3.0,
                tapCount: 1,
                lastActionTime: Date.now(),
                multiplierMode: 1,
            };
            bot.activeBots.set("bot1", botState);
            const { getNextMultiplier } = require("../../helpers/crash-point-helper");
            getNextMultiplier.mockReturnValue(3.5);

            // Act
            await bot.handleMining("bot1");

            // Assert
            expect(botState.multiplier).toBe(0);
        });

        it("should update bot state", async () => {
            // Arrange
            const bot = initBot();
            bot.gameData.gameConfigs = {
                crashConfig: {
                    fixedStepsMultiplierConfigs: [
                        {
                            mode: 1,
                            multiplierSteps: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
                        },
                    ],
                },
            };
            bot.activeBots.set("bot1", {
                multiplier: 1.5,
                result: 3.0,
                tapCount: 1,
                lastActionTime: Date.now(),
                multiplierMode: 1,
            });
            const { getNextMultiplier } = require("../../helpers/crash-point-helper");
            getNextMultiplier.mockReturnValue(1.6);

            // Act
            await bot.handleMining("bot1");

            // Assert
            const botState = bot.activeBots.get("bot1");
            expect(botState.hasMined).toBe(true);
            expect(botState.tapCount).toBe(2);
            expect(typeof botState.lastActionTime).toBe("number");
        });

        it("should publish player mine event", async () => {
            // Arrange
            const bot = initBot();
            bot.gameData.gameConfigs = {
                crashConfig: {
                    fixedStepsMultiplierConfigs: [
                        {
                            mode: 1,
                            multiplierSteps: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
                        },
                    ],
                },
            };
            bot.activeBots.set("bot1", {
                multiplier: 1.5,
                result: 3.0,
                tapCount: 1,
                lastActionTime: Date.now(),
                multiplierMode: 1,
            });
            const { getNextMultiplier } = require("../../helpers/crash-point-helper");
            getNextMultiplier.mockReturnValue(1.6);

            // Act
            await bot.handleMining("bot1");

            // Assert
            expect(bot.publisher.publishToAllUsersExceptSystem).toHaveBeenCalled();
        });

        it("should handle cashout when multiplier is 0", async () => {
            // Arrange
            const bot = initBot();
            bot.gameData.gameConfigs = {
                crashConfig: {
                    fixedStepsMultiplierConfigs: [
                        {
                            mode: 1,
                            multiplierSteps: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
                        },
                    ],
                },
            };
            bot.activeBots.set("bot1", {
                multiplier: 1.5,
                result: 3.0,
                tapCount: 1,
                lastActionTime: Date.now(),
                multiplierMode: 1,
            });
            const { getNextMultiplier } = require("../../helpers/crash-point-helper");
            getNextMultiplier.mockReturnValue(0);
            bot.handleCashout = jest.fn();

            // Act
            await bot.handleMining("bot1");

            // Assert
            expect(bot.handleCashout).toHaveBeenCalledWith("bot1");
        });
    });

    describe("handleCashout method", () => {
        it("should calculate winning amounts", async () => {
            // Arrange
            const bot = initBot();
            bot.gameData.roundId = 1;
            bot.recentBetConsumer.update = jest.fn().mockResolvedValue({
                name: "Bot1",
                amount: 100,
                multiplier: 2.5,
                winningAmount: 250,
                baseWinningAmount: 250,
            });
            bot.recentBetPublisher.publish = jest.fn();
            bot.activeBots.set("bot1", {
                multiplier: 2.5,
                amount: 100,
            });
            bot.botRate = 1.0;
            userInfosRepository.findOneAndUpdate.mockResolvedValue({ red: 1000, name: "Bot1" });
            const { roundMultiplier } = require("../../helpers/number-helper");
            roundMultiplier
                .mockImplementationOnce((multiplier, amount) => 250) // winningAmount = roundMultiplier(2.5, 100)
                .mockImplementationOnce((winningAmount, rate) => 250); // baseWinningAmount = roundMultiplier(250, 1.0)

            // Act
            await bot.handleCashout("bot1");

            // Assert
            expect(roundMultiplier).toHaveBeenCalledWith(2.5, 100);
            expect(userInfosRepository.findOneAndUpdate).toHaveBeenCalledWith({ id: "bot1" }, { $inc: { red: 250 } });
        });

        it("should update player balance in gameData", async () => {
            // Arrange
            const bot = initBot();
            bot.gameData.roundId = 1;
            bot.recentBetConsumer.update = jest.fn().mockResolvedValue({
                name: "Bot1",
                amount: 100,
                multiplier: 2.5,
                winningAmount: 250,
                baseWinningAmount: 250,
            });
            bot.recentBetPublisher.publish = jest.fn();
            bot.activeBots.set("bot1", {
                multiplier: 2.5,
                amount: 100,
            });
            bot.botRate = 1.0;
            bot.gameData.players["bot1"] = { red: 500 };
            userInfosRepository.findOneAndUpdate.mockResolvedValue({ red: 1000, name: "Bot1" });
            const { roundMultiplier } = require("../../helpers/number-helper");
            roundMultiplier
                .mockImplementationOnce((multiplier, amount) => 250) // winningAmount
                .mockImplementationOnce((winningAmount, rate) => 250); // baseWinningAmount

            // Act
            await bot.handleCashout("bot1");

            // Assert
            expect(bot.gameData.players["bot1"].red).toBe(1000);
        });

        it("should call update and publish recent bet", async () => {
            // Arrange
            const bot = initBot();
            bot.gameData.roundId = 1;
            const mockRecentBet = {
                name: "Bot1",
                amount: 100,
                multiplier: 2.5,
                winningAmount: 250,
                baseWinningAmount: 250,
            };
            bot.recentBetConsumer.update = jest.fn().mockResolvedValue(mockRecentBet);
            bot.recentBetPublisher.publish = jest.fn();
            bot.activeBots.set("bot1", {
                multiplier: 2.5,
                amount: 100,
            });
            bot.botRate = 1.0;
            userInfosRepository.findOneAndUpdate.mockResolvedValue({ red: 1000, name: "Bot1" });
            const { roundMultiplier } = require("../../helpers/number-helper");
            roundMultiplier
                .mockImplementationOnce((multiplier, amount) => 250) // winningAmount
                .mockImplementationOnce((winningAmount, rate) => 250); // baseWinningAmount

            // Act
            await bot.handleCashout("bot1");

            // Assert
            expect(bot.recentBetConsumer.update).toHaveBeenCalledWith({
                roundId: 1,
                winningAmount: 250,
                baseWinningAmount: 250,
                multiplier: 2.5,
            });
            expect(bot.recentBetPublisher.publish).toHaveBeenCalledWith(mockRecentBet);
        });

        it("should publish recent bet event", async () => {
            // Arrange
            const bot = initBot();
            bot.gameData.roundId = 1;
            const mockRecentBet = {
                name: "Bot1",
                amount: 100,
                multiplier: 2.5,
                winningAmount: 250,
                baseWinningAmount: 250,
            };
            bot.recentBetConsumer.update = jest.fn().mockResolvedValue(mockRecentBet);
            bot.recentBetPublisher.publish = jest.fn();
            bot.activeBots.set("bot1", {
                multiplier: 2.5,
                amount: 100,
            });
            bot.botRate = 1.0;
            userInfosRepository.findOneAndUpdate.mockResolvedValue({ red: 1000, name: "Bot1" });
            const { roundMultiplier } = require("../../helpers/number-helper");
            roundMultiplier
                .mockImplementationOnce((multiplier, amount) => 250) // winningAmount
                .mockImplementationOnce((winningAmount, rate) => 250); // baseWinningAmount

            // Act
            await bot.handleCashout("bot1");

            // Assert
            expect(bot.recentBetPublisher.publish).toHaveBeenCalledWith(mockRecentBet);
        });

        it("should remove bot from activeBots", async () => {
            // Arrange
            const bot = initBot();
            bot.gameData.roundId = 1;
            bot.recentBetConsumer.update = jest.fn().mockResolvedValue({
                name: "Bot1",
                amount: 100,
                multiplier: 2.5,
                winningAmount: 250,
                baseWinningAmount: 250,
            });
            bot.recentBetPublisher.publish = jest.fn();
            bot.activeBots.set("bot1", {
                multiplier: 2.5,
                amount: 100,
            });
            bot.botRate = 1.0;
            userInfosRepository.findOneAndUpdate.mockResolvedValue({ red: 1000, name: "Bot1" });
            const { roundMultiplier } = require("../../helpers/number-helper");
            roundMultiplier
                .mockImplementationOnce((multiplier, amount) => 250) // winningAmount
                .mockImplementationOnce((winningAmount, rate) => 250); // baseWinningAmount

            // Act
            await bot.handleCashout("bot1");

            // Assert
            expect(bot.activeBots.has("bot1")).toBe(false);
        });
    });

    describe("resetBot method", () => {
        it("should clear timeouts and remove from activeBots", () => {
            // Arrange
            const bot = initBot();
            bot.clearTimeouts = jest.fn();
            bot.activeBots.set("bot1", {});
            const botToReset = { id: "bot1" };

            // Act
            bot.resetBot(botToReset);

            // Assert
            expect(bot.clearTimeouts).toHaveBeenCalled();
            expect(bot.activeBots.has("bot1")).toBe(false);
        });
    });

    describe("removeBot method", () => {
        it("should clear timeouts and remove from activeBots", async () => {
            // Arrange
            const bot = initBot();
            bot.clearTimeouts = jest.fn();
            bot.activeBots.set("bot1", {});

            // Act
            await bot.removeBot("bot1");

            // Assert
            expect(bot.clearTimeouts).toHaveBeenCalled();
            expect(bot.activeBots.has("bot1")).toBe(false);
        });
    });

    describe("getMaxBet method", () => {
        it("should return minimum of bot maxBet, red balance, and game config", () => {
            // Arrange
            const bot = initBot();
            const botUser = { profile: { maxBet: 2000 }, red: 1500 };
            bot.gameData.gameConfigs.bot_maxbet = 1000;

            // Act
            const result = bot.getMaxBet(botUser);

            // Assert
            expect(result).toBe(1000);
        });

        it("should use game config maxBet when bot has no profile", () => {
            // Arrange
            const bot = initBot();
            const botUser = { red: 1500 };
            bot.gameData.gameConfigs.maxbet = 500;
            bot.gameData.gameConfigs.bot_maxbet = 1000;

            // Act
            const result = bot.getMaxBet(botUser);

            // Assert
            expect(result).toBe(500);
        });
    });

    describe("getBetChoice method", () => {
        it("should return Bet action", () => {
            // Arrange
            const bot = initBot();

            // Act
            const result = bot.getBetChoice();

            // Assert
            expect(result).toBe("bet");
        });
    });

    describe("getBotsToJoin method", () => {
        it("should return empty array when no remaining slots", () => {
            // Arrange
            const bot = initBot();
            bot.maxNumberOfBots = 5;
            bot.botsInRoom = { bot1: {}, bot2: {}, bot3: {}, bot4: {}, bot5: {} };

            // Act
            const result = bot.getBotsToJoin([]);

            // Assert
            expect(result).toEqual([]);
        });

        it("should return shuffled bots up to remaining slots", () => {
            // Arrange
            const bot = initBot();
            bot.maxNumberOfBots = 5;
            bot.botsInRoom = { bot1: {}, bot2: {} };
            const botUsers = [{ id: "bot3" }, { id: "bot4" }, { id: "bot5" }];
            bot.chance.integer = jest.fn().mockReturnValue(2);
            bot.chance.shuffle = jest.fn().mockReturnValue([{ id: "bot5" }, { id: "bot3" }, { id: "bot4" }]);

            // Act
            const result = bot.getBotsToJoin(botUsers);

            // Assert
            expect(result).toEqual([{ id: "bot5" }, { id: "bot3" }]);
            expect(bot.chance.integer).toHaveBeenCalledWith({ min: 1, max: 3 });
            expect(bot.chance.shuffle).toHaveBeenCalledWith(botUsers);
        });
    });
});
