import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { BaseEventPublisher } from "sc-game-base/src/core/event-publishers";
import { SeedHelper, ServerSeedHelper } from "sc-game-base/src/core/helpers";
import { TableGameDefinition } from "sc-game-base/src/table";
import { RecentBetConsumer } from "../../consumers";
import CrashGameData from "../../game-data";
import gameSettings from "../../game-settings";
import Bot from "../bot";
jest.mock("sc-game-base/src/core/event-publishers/base-event-publisher");
jest.mock("../../helpers/crash-point-helper", () => ({
    getNextMultiplier: jest.fn(),
}));
jest.mock("../../consumers", () => ({
    RecentBetConsumer: jest.fn(),
}));
jest.mock("sc-game-base/src/core/helpers", () => ({
    ServerSeedHelper: {
        generateServerSeed: jest.fn(),
    },
    SeedHelper: {
        getSHA512Hash: jest.fn(),
    },
}));

const userInfosRepository = stubMongoose(mongoose.Model);
const publisher = new BaseEventPublisher();
const definition = new TableGameDefinition(gameSettings);
let gameData = new CrashGameData();
const recentBetConsumer = stub(RecentBetConsumer);

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
    return new Bot(definition, gameData, publisher, userInfosRepository, recentBetConsumer);
}

afterEach(() => {
    jest.clearAllMocks();
    gameData = new CrashGameData();
    gameData.gameConfigs = {
        crashConfig: {
            fixedStepsMultiplierConfigs,
        },
    };
    // Reset seed helper mocks
    ServerSeedHelper.generateServerSeed.mockReturnValue("mock-server-seed");
    SeedHelper.getSHA512Hash.mockReturnValue("mock-final-hash");
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
            bot.botsInRoom = { bot1: { red: 1000 } };
            bot.gameData.roundId = 1;
            bot.getMaxBet = jest.fn().mockReturnValue(100);
            bot.getMinBet = jest.fn().mockReturnValue(10);
            bot.convertAmountToChip = jest.fn().mockReturnValue(50);
            bot.handleCashout = jest.fn();
            bot.definition.generateResult = jest.fn().mockReturnValue(2.5);
            bot.chance.integer = jest.fn().mockReturnValue(1); // Mock multiplierMode to 1
            bot.botRate = 1.0;
            bot.recentBetConsumer.add = jest.fn().mockResolvedValue({});
            const mockUser = { id: "bot1", red: 1000, name: "Bot1" };
            userInfosRepository.findOneAndUpdate.mockResolvedValue(mockUser);

            // Act
            await bot.placeBet("bot1");

            // Assert
            expect(bot.gameData.roundId).toBe(2);
            expect(ServerSeedHelper.generateServerSeed).toHaveBeenCalled();
            expect(SeedHelper.getSHA512Hash).toHaveBeenCalledWith("mock-server-seed");
            expect(bot.definition.generateResult).toHaveBeenCalledWith("mock-final-hash");
        });

        it("should get max and min bet amounts", async () => {
            // Arrange
            const bot = initBot();
            bot.botsInRoom = { bot1: { red: 1000 } };
            bot.getMaxBet = jest.fn().mockReturnValue(100);
            bot.getMinBet = jest.fn().mockReturnValue(10);
            bot.convertAmountToChip = jest.fn().mockReturnValue(50);
            bot.handleCashout = jest.fn();
            bot.definition.generateResult = jest.fn().mockReturnValue(2.5);
            bot.chance.integer = jest.fn().mockReturnValue(1); // Mock multiplierMode to 1
            bot.botRate = 1.0;
            bot.recentBetConsumer.add = jest.fn().mockResolvedValue({});
            const mockUser = { id: "bot1", red: 1000, name: "Bot1" };
            userInfosRepository.findOneAndUpdate.mockResolvedValue(mockUser);

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
            bot.handleCashout = jest.fn();
            bot.definition.generateResult = jest.fn().mockReturnValue(2.5);
            bot.chance.integer = jest.fn().mockReturnValue(1); // Mock multiplierMode to 1
            bot.botRate = 1.0;
            bot.recentBetConsumer.add = jest.fn().mockResolvedValue({});
            const mockUser = { id: "bot1", red: 1000, name: "Bot1" };
            userInfosRepository.findOneAndUpdate.mockResolvedValue(mockUser);

            // Act
            await bot.placeBet("bot1");

            // Assert
        });

        it("should set active bot state", async () => {
            // Arrange
            const bot = initBot();
            bot.botsInRoom = { bot1: { red: 1000 } };
            bot.gameData.roundId = 1;
            bot.getMaxBet = jest.fn().mockReturnValue(100);
            bot.getMinBet = jest.fn().mockReturnValue(10);
            bot.convertAmountToChip = jest.fn().mockReturnValue(50);
            bot.handleCashout = jest.fn();
            bot.definition.generateResult = jest.fn().mockReturnValue(2.5);
            bot.chance.integer = jest.fn().mockReturnValue(1); // Mock multiplierMode to 1
            bot.botRate = 1.0;
            bot.recentBetConsumer.add = jest.fn().mockResolvedValue({});
            const mockUser = { id: "bot1", red: 1000, name: "Bot1" };
            userInfosRepository.findOneAndUpdate.mockResolvedValue(mockUser);

            // Act
            await bot.placeBet("bot1");

            // Assert
            const botState = bot.activeBots.get("bot1");
            expect(botState).toMatchObject({
                amount: 50,
                result: expect.any(Number),
                multiplier: 1.0,
                tapCount: 1,
                lastActionTime: expect.any(Number),
                multiplierMode: 1,
                roundId: 2,
            });
            // Check that targetRange and rangeId are present
            expect(botState).toHaveProperty("targetRange");
            expect(botState).toHaveProperty("rangeId");
        });

        it("should handle cashout when multiplier is 0", async () => {
            // Arrange
            const bot = initBot();
            bot.botsInRoom = { bot1: { red: 1000 } };
            bot.getMaxBet = jest.fn().mockReturnValue(100);
            bot.getMinBet = jest.fn().mockReturnValue(10);
            bot.convertAmountToChip = jest.fn().mockReturnValue(50);
            bot.handleCashout = jest.fn();
            bot.definition.generateResult = jest.fn().mockReturnValue(0.5);
            bot.chance.integer = jest.fn().mockReturnValue(1); // Mock multiplierMode to 1
            bot.botRate = 1.0;
            bot.recentBetConsumer.add = jest.fn().mockResolvedValue({});
            const mockUser = { id: "bot1", red: 1000, name: "Bot1" };
            userInfosRepository.findOneAndUpdate.mockResolvedValue(mockUser);

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
            bot.handleCashout = jest.fn();
            bot.definition.generateResult = jest.fn().mockReturnValue(0.5); // Less than firstMultiplier (1.0)
            bot.chance.integer = jest.fn().mockReturnValue(1); // Mock multiplierMode to 1
            bot.botRate = 1.0;
            bot.recentBetConsumer.add = jest.fn().mockResolvedValue({});
            const mockUser = { id: "bot1", red: 1000, name: "Bot1" };
            userInfosRepository.findOneAndUpdate.mockResolvedValue(mockUser);

            // Act
            await bot.placeBet("bot1");

            // Assert
            expect(bot.activeBots.get("bot1").multiplier).toBe(0);
        });

        it("should set multiplier to firstMultiplier when result is greater than firstMultiplier", async () => {
            // Arrange
            const bot = initBot();
            bot.botsInRoom = { bot1: { red: 1000 } };
            bot.getMaxBet = jest.fn().mockReturnValue(100);
            bot.getMinBet = jest.fn().mockReturnValue(10);
            bot.convertAmountToChip = jest.fn().mockReturnValue(50);
            bot.handleCashout = jest.fn();
            bot.definition.generateResult = jest.fn().mockReturnValue(1.5); // Greater than firstMultiplier (1.0)
            bot.chance.integer = jest.fn().mockReturnValue(1); // Mock multiplierMode to 1
            bot.botRate = 1.0;
            bot.recentBetConsumer.add = jest.fn().mockResolvedValue({});
            const mockUser = { id: "bot1", red: 1000, name: "Bot1" };
            userInfosRepository.findOneAndUpdate.mockResolvedValue(mockUser);

            // Act
            await bot.placeBet("bot1");

            // Assert
            expect(bot.activeBots.get("bot1").multiplier).toBe(1.0);
        });

        it("should not process bet when user not found", async () => {
            // Arrange
            const bot = initBot();
            bot.botsInRoom = { bot1: { red: 1000 } };
            bot.gameData.roundId = 1;
            bot.getMaxBet = jest.fn().mockReturnValue(100);
            bot.getMinBet = jest.fn().mockReturnValue(10);
            bot.convertAmountToChip = jest.fn().mockReturnValue(50);
            bot.handleCashout = jest.fn();
            bot.recentBetConsumer.add = jest.fn();
            userInfosRepository.findOneAndUpdate.mockResolvedValue(null);

            // Act
            await bot.placeBet("bot1");

            // Assert
            expect(bot.gameData.roundId).toBe(1); // Should not increment
            expect(bot.activeBots.has("bot1")).toBe(false); // Should not set active bot
            expect(bot.recentBetConsumer.add).not.toHaveBeenCalled();
            expect(bot.handleCashout).not.toHaveBeenCalled();
        });

        it("should not process bet when user has insufficient balance", async () => {
            // Arrange
            const bot = initBot();
            bot.botsInRoom = { bot1: { red: 30 } }; // Balance less than bet amount
            bot.gameData.roundId = 1;
            bot.getMaxBet = jest.fn().mockReturnValue(100);
            bot.getMinBet = jest.fn().mockReturnValue(10);
            bot.convertAmountToChip = jest.fn().mockReturnValue(50); // Bet amount is 50, but balance is only 30
            bot.handleCashout = jest.fn();
            bot.recentBetConsumer.add = jest.fn();
            // Query will fail because red (30) is not greater than betAmount (50)
            userInfosRepository.findOneAndUpdate.mockResolvedValue(null);

            // Act
            await bot.placeBet("bot1");

            // Assert
            expect(userInfosRepository.findOneAndUpdate).toHaveBeenCalledWith(
                { id: "bot1", red: { $gt: 50 } },
                { $inc: { red: -50 } },
                { new: true, lean: true }
            );
            expect(bot.gameData.roundId).toBe(1); // Should not increment
            expect(bot.activeBots.has("bot1")).toBe(false); // Should not set active bot
            expect(bot.recentBetConsumer.add).not.toHaveBeenCalled();
            expect(bot.handleCashout).not.toHaveBeenCalled();
        });

        it("should call recentBetConsumer.add and recentBetPublisher.publish", async () => {
            // Arrange
            const bot = initBot();
            bot.botsInRoom = { bot1: { red: 1000 } };
            bot.gameData.roundId = 1;
            bot.getMaxBet = jest.fn().mockReturnValue(100);
            bot.getMinBet = jest.fn().mockReturnValue(10);
            bot.convertAmountToChip = jest.fn().mockReturnValue(50);
            bot.handleCashout = jest.fn();
            bot.definition.generateResult = jest.fn().mockReturnValue(2.5);
            bot.chance.integer = jest.fn().mockReturnValue(1); // Mock multiplierMode to 1
            bot.botRate = 1.0;
            const mockRecentBet = { id: "bet1", amount: 50, multiplier: 1.0 };
            bot.recentBetConsumer.add = jest.fn().mockResolvedValue(mockRecentBet);
            const mockUser = { id: "bot1", red: 1000, name: "Bot1" };
            userInfosRepository.findOneAndUpdate.mockResolvedValue(mockUser);

            // Act
            await bot.placeBet("bot1");

            // Assert
            expect(bot.recentBetConsumer.add).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: "bot1",
                    red: 1000,
                    name: "Bot1",
                    profile: { name: "Bot1" },
                }),
                {
                    roundId: 2,
                    amount: 50,
                    baseAmount: 50, // betAmount * botRate = 50 * 1.0
                    rate: 1.0,
                }
            );
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
        it("should return Bet action with 10% probability when no bot state", () => {
            // Arrange
            const bot = initBot();
            bot.activeBots.clear();
            bot.chance.bool = jest.fn().mockReturnValue(true);

            // Act
            const result = bot.getAction("bot1");

            // Assert
            expect(result).toBe("bet");
            expect(bot.chance.bool).toHaveBeenCalledWith({ likelihood: 10 });
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

        it("should use range-based logic when bot state exists", () => {
            // Arrange
            const bot = initBot();
            const botState = {
                multiplier: 0.5,
                targetRange: { min: 1.01, max: 2.0 },
            };
            bot.activeBots.set("bot1", botState);
            bot.chance.bool = jest.fn().mockReturnValue(true);

            // Act
            const result = bot.getAction("bot1");

            // Assert
            // When below range, should return mine or null based on 60% chance
            expect(result).toBe("mine");
            expect(bot.chance.bool).toHaveBeenCalledWith({ likelihood: 60 });
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

        it("should update multiplier in bot state", async () => {
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
            expect(bot.activeBots.get("bot1").multiplier).toBe(1.6);
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

        it("should handle cashout when multiplier reaches maxMultiplier", async () => {
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
                multiplier: 1.9,
                result: 3.0,
                tapCount: 1,
                lastActionTime: Date.now(),
                multiplierMode: 1,
            });
            const { getNextMultiplier } = require("../../helpers/crash-point-helper");
            getNextMultiplier.mockReturnValue(2.0); // maxMultiplier for mode 1
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
            bot.recentBetConsumer.update = jest.fn().mockResolvedValue();
            bot.activeBots.set("bot1", {
                multiplier: 2.5,
                amount: 100,
                roundId: 1,
            });
            bot.botRate = 1.0;
            userInfosRepository.findOneAndUpdate.mockResolvedValue({ red: 1000, name: "Bot1" });

            // Act
            await bot.handleCashout("bot1");

            // Assert
            expect(userInfosRepository.findOneAndUpdate).toHaveBeenCalledWith({ id: "bot1" }, { $inc: { red: 250 } }); // 2.5 * 100
        });

        it("should update player balance in gameData", async () => {
            // Arrange
            const bot = initBot();
            bot.recentBetConsumer.update = jest.fn().mockResolvedValue();
            bot.activeBots.set("bot1", {
                multiplier: 2.5,
                amount: 100,
                roundId: 1,
            });
            bot.botRate = 1.0;
            bot.gameData.players["bot1"] = { red: 500 };
            userInfosRepository.findOneAndUpdate.mockResolvedValue({ red: 1000, name: "Bot1" });

            // Act
            await bot.handleCashout("bot1");

            // Assert
            expect(bot.gameData.players["bot1"].red).toBe(1000);
        });

        it("should call update recent bet", async () => {
            // Arrange
            const bot = initBot();
            bot.recentBetConsumer.update = jest.fn().mockResolvedValue();
            bot.activeBots.set("bot1", {
                multiplier: 2.5,
                amount: 100,
                roundId: 1,
            });
            bot.botRate = 1.0;
            userInfosRepository.findOneAndUpdate.mockResolvedValue({ red: 1000, name: "Bot1" });

            // Act
            await bot.handleCashout("bot1");

            // Assert
            expect(bot.recentBetConsumer.update).toHaveBeenCalledWith({
                roundId: 1,
                winningAmount: 250, // 2.5 * 100
                baseWinningAmount: 250, // 250 * 1.0
                multiplier: 2.5,
            });
        });

        it("should remove bot from activeBots", async () => {
            // Arrange
            const bot = initBot();
            bot.recentBetConsumer.update = jest.fn().mockResolvedValue();
            bot.activeBots.set("bot1", {
                multiplier: 2.5,
                amount: 100,
                roundId: 1,
            });
            bot.botRate = 1.0;
            userInfosRepository.findOneAndUpdate.mockResolvedValue({ red: 1000, name: "Bot1" });

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

        it("should release slot when bot has rangeId", () => {
            // Arrange
            const bot = initBot();
            bot.clearTimeouts = jest.fn();
            bot.activeBots.set("bot1", { rangeId: 1 });
            bot.reserveSlot(1, "bot1");
            const botToReset = { id: "bot1" };

            // Act
            bot.resetBot(botToReset);

            // Assert
            expect(bot.targetRangeSlots.get(1).has("bot1")).toBe(false);
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

        it("should release slot when bot has rangeId", async () => {
            // Arrange
            const bot = initBot();
            bot.clearTimeouts = jest.fn();
            bot.activeBots.set("bot1", { rangeId: 1 });
            bot.reserveSlot(1, "bot1");

            // Act
            await bot.removeBot("bot1");

            // Assert
            expect(bot.targetRangeSlots.get(1).has("bot1")).toBe(false);
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

    describe("Slot Management", () => {
        describe("getTargetRangeSlots method", () => {
            it("should return empty array when no bots in room", () => {
                // Arrange
                const bot = initBot();
                bot.botsInRoom = {};

                // Act
                const result = bot.getTargetRangeSlots(1);

                // Assert
                expect(result).toEqual([]);
            });

            it("should calculate slots correctly based on bot count and ratios", () => {
                // Arrange
                const bot = initBot();
                bot.botsInRoom = {
                    bot1: {},
                    bot2: {},
                    bot3: {},
                    bot4: {},
                    bot5: {},
                    bot6: {},
                    bot7: {},
                    bot8: {},
                    bot9: {},
                    bot10: {},
                    bot11: {},
                    bot12: {},
                    bot13: {},
                    bot14: {},
                    bot15: {},
                    bot16: {},
                    bot17: {},
                    bot18: {},
                    bot19: {},
                    bot20: {},
                }; // 20 bots

                // Act
                const result = bot.getTargetRangeSlots(1);

                // Assert
                expect(result).toHaveLength(5);
                // Range 1: 55% of 20 = 11 slots
                expect(result[0].totalSlots).toBe(11);
                expect(result[0].ratio).toBe(0.55);
                // Range 2: 20% of 20 = 4 slots
                expect(result[1].totalSlots).toBe(4);
                expect(result[1].ratio).toBe(0.20);
                // Range 3: 15% of 20 = 3 slots
                expect(result[2].totalSlots).toBe(3);
                // Range 4: 5% of 20 = 1 slot
                expect(result[3].totalSlots).toBe(1);
                // Range 5: 5% of 20 = 1 slot
                expect(result[4].totalSlots).toBe(1);
                expect(result[4].ratio).toBe(0.05);
            });

            it("should track occupied and available slots correctly", () => {
                // Arrange
                const bot = initBot();
                bot.botsInRoom = { bot1: {}, bot2: {}, bot3: {}, bot4: {} }; // 4 bots
                bot.reserveSlot(1, "bot1");
                bot.reserveSlot(1, "bot2");

                // Act
                const result = bot.getTargetRangeSlots(1);

                // Assert
                const range1 = result.find((r) => r.id === 1);
                expect(range1.totalSlots).toBe(2); // 55% of 4 = 2.2, rounded to 2
                expect(range1.occupiedSlots).toBe(2);
                expect(range1.availableSlots).toBe(0);
            });
        });

        describe("reserveSlot method", () => {
            it("should reserve a slot for a bot in the specified range", () => {
                // Arrange
                const bot = initBot();
                const rangeId = 1;
                const botId = "bot1";

                // Act
                bot.reserveSlot(rangeId, botId);

                // Assert
                const slots = bot.targetRangeSlots.get(rangeId);
                expect(slots.has(botId)).toBe(true);
            });

            it("should not reserve slot for invalid range", () => {
                // Arrange
                const bot = initBot();
                const invalidRangeId = "invalidRange";
                const botId = "bot1";

                // Act
                bot.reserveSlot(invalidRangeId, botId);

                // Assert
                const slots = bot.targetRangeSlots.get(invalidRangeId);
                expect(slots).toBeUndefined();
            });
        });

        describe("releaseSlot method", () => {
            it("should release a slot for a bot", () => {
                // Arrange
                const bot = initBot();
                const rangeId = 1;
                const botId = "bot1";
                bot.reserveSlot(rangeId, botId);

                // Act
                bot.releaseSlot(rangeId, botId);

                // Assert
                const slots = bot.targetRangeSlots.get(rangeId);
                expect(slots.has(botId)).toBe(false);
            });

            it("should handle release when rangeId is null", () => {
                // Arrange
                const bot = initBot();
                const botId = "bot1";

                // Act & Assert - should not throw
                expect(() => bot.releaseSlot(null, botId)).not.toThrow();
            });
        });
    });

    describe("assignTargetRange method", () => {
        it("should assign a target range and reserve slot", () => {
            // Arrange
            const bot = initBot();
            bot.botsInRoom = { bot1: {}, bot2: {}, bot3: {}, bot4: {} }; // 4 bots
            bot.chance.weighted = jest.fn().mockReturnValue({
                id: 1,
                min: 1.01,
                max: 2.0,
                ratio: 0.55,
                totalSlots: 2,
                occupiedSlots: 0,
                availableSlots: 2,
            });

            // Act
            const result = bot.assignTargetRange("bot1", 1);

            // Assert
            expect(result).toHaveProperty("rangeId");
            expect(result).toHaveProperty("min");
            expect(result).toHaveProperty("max");
            expect(bot.targetRangeSlots.get(1).has("bot1")).toBe(true);
        });

        it("should use fallback to first range when no slots available", () => {
            // Arrange
            const bot = initBot();
            bot.botsInRoom = { bot1: {} };
            // Mock getTargetRangeSlots to return no available ranges
            bot.getTargetRangeSlots = jest.fn().mockReturnValue([]);

            // Act
            const result = bot.assignTargetRange("bot1", 1);

            // Assert
            expect(result.rangeId).toBe(1);
            expect(result.min).toBe(1.01);
            expect(result.max).toBe(2.0);
            expect(bot.targetRangeSlots.get(1).has("bot1")).toBe(true);
        });

        it("should use getMaxMultiplier for dynamic max range", () => {
            // Arrange
            const bot = initBot();
            bot.botsInRoom = { bot1: {} };
            bot.chance.weighted = jest.fn().mockReturnValue({
                id: 5,
                min: 7.1,
                max: 10.0, // Dynamic max resolved to mode 1 max
                ratio: 0.05,
                totalSlots: 1,
                occupiedSlots: 0,
                availableSlots: 1,
            });

            // Act
            const result = bot.assignTargetRange("bot1", 1); // Pass multiplierMode

            // Assert
            expect(result.max).toBe(10.0);
        });
    });

    describe("isInTargetRange method", () => {
        it("should return BELOW when multiplier is less than min", () => {
            // Arrange
            const bot = initBot();
            const multiplier = 1.0;
            const targetRange = { min: 1.01, max: 2.0 };

            // Act
            const result = bot.isInTargetRange(multiplier, targetRange);

            // Assert
            expect(result).toBe("below");
        });

        it("should return WITHIN when multiplier is within range", () => {
            // Arrange
            const bot = initBot();
            const multiplier = 1.5;
            const targetRange = { min: 1.01, max: 2.0 };

            // Act
            const result = bot.isInTargetRange(multiplier, targetRange);

            // Assert
            expect(result).toBe("within");
        });

        it("should return WITHIN when multiplier equals min", () => {
            // Arrange
            const bot = initBot();
            const multiplier = 1.01;
            const targetRange = { min: 1.01, max: 2.0 };

            // Act
            const result = bot.isInTargetRange(multiplier, targetRange);

            // Assert
            expect(result).toBe("within");
        });

        it("should return WITHIN when multiplier equals max", () => {
            // Arrange
            const bot = initBot();
            const multiplier = 2.0;
            const targetRange = { min: 1.01, max: 2.0 };

            // Act
            const result = bot.isInTargetRange(multiplier, targetRange);

            // Assert
            expect(result).toBe("within");
        });

        it("should return ABOVE when multiplier is greater than max", () => {
            // Arrange
            const bot = initBot();
            const multiplier = 2.5;
            const targetRange = { min: 1.01, max: 2.0 };

            // Act
            const result = bot.isInTargetRange(multiplier, targetRange);

            // Assert
            expect(result).toBe("above");
        });

        it("should return BELOW when targetRange is null", () => {
            // Arrange
            const bot = initBot();
            const multiplier = 1.5;

            // Act
            const result = bot.isInTargetRange(multiplier, null);

            // Assert
            expect(result).toBe("below");
        });
    });

    describe("getMaxMultiplier method", () => {
        it("should return maximum multiplier for specific mode", () => {
            // Arrange
            const bot = initBot();
            // fixedStepsMultiplierConfigs already set up in beforeEach
            // Mode 4 max: 10.0

            // Act
            const result = bot.getMaxMultiplier(4);

            // Assert
            expect(result).toBe(10.0);
        });
    });

    describe("getAction method with range-based logic", () => {
        it("should return Bet or null when bot has no state", () => {
            // Arrange
            const bot = initBot();
            bot.chance.bool = jest.fn().mockReturnValue(true);

            // Act
            const result = bot.getAction("bot1");

            // Assert
            expect(result).toBe("bet");
            expect(bot.chance.bool).toHaveBeenCalledWith({ likelihood: 10 });
        });

        it("should return Mine or null when below target range", () => {
            // Arrange
            const bot = initBot();
            bot.activeBots.set("bot1", {
                multiplier: 0.5,
                targetRange: { min: 1.01, max: 2.0 },
            });
            bot.chance.bool = jest.fn().mockReturnValue(true);

            // Act
            const result = bot.getAction("bot1");

            // Assert
            expect(result).toBe("mine");
            expect(bot.chance.bool).toHaveBeenCalledWith({ likelihood: 60 });
        });

        it("should return null when below target range and chance is false", () => {
            // Arrange
            const bot = initBot();
            bot.activeBots.set("bot1", {
                multiplier: 0.5,
                targetRange: { min: 1.01, max: 2.0 },
            });
            bot.chance.bool = jest.fn().mockReturnValue(false);

            // Act
            const result = bot.getAction("bot1");

            // Assert
            expect(result).toBeNull();
        });

        it("should return weighted action when within target range", () => {
            // Arrange
            const bot = initBot();
            bot.activeBots.set("bot1", {
                multiplier: 1.5,
                targetRange: { min: 1.01, max: 2.0 },
            });
            bot.chance.weighted = jest.fn().mockReturnValue("cashOut");

            // Act
            const result = bot.getAction("bot1");

            // Assert
            expect(result).toBe("cashOut");
            expect(bot.chance.weighted).toHaveBeenCalledWith(
                ["cashOut", "mine", null],
                [35, 40, 25]
            );
        });

        it("should return CashOut when above target range", () => {
            // Arrange
            const bot = initBot();
            bot.activeBots.set("bot1", {
                multiplier: 2.5,
                targetRange: { min: 1.01, max: 2.0 },
            });

            // Act
            const result = bot.getAction("bot1");

            // Assert
            expect(result).toBe("cashOut");
        });
    });

    describe("placeBet with target range assignment", () => {
        it("should assign target range when placing bet", async () => {
            // Arrange
            const bot = initBot();
            bot.botsInRoom = { bot1: { red: 1000 } };
            bot.gameData.roundId = 1;
            bot.getMaxBet = jest.fn().mockReturnValue(100);
            bot.getMinBet = jest.fn().mockReturnValue(10);
            bot.convertAmountToChip = jest.fn().mockReturnValue(50);
            bot.handleCashout = jest.fn();
            bot.definition.generateResult = jest.fn().mockReturnValue(2.5);
            bot.chance.integer = jest.fn().mockReturnValue(1);
            bot.botRate = 1.0;
            bot.recentBetConsumer.add = jest.fn().mockResolvedValue({});
            bot.getMaxMultiplier = jest.fn().mockReturnValue(10.0);
            bot.chance.weighted = jest.fn().mockReturnValue({
                id: 1,
                min: 1.01,
                max: 2.0,
                ratio: 0.55,
                totalSlots: 1,
                occupiedSlots: 0,
                availableSlots: 1,
            });
            const mockUser = { id: "bot1", red: 1000, name: "Bot1" };
            userInfosRepository.findOneAndUpdate.mockResolvedValue(mockUser);

            // Act
            await bot.placeBet("bot1");

            // Assert
            const botState = bot.activeBots.get("bot1");
            expect(botState).toHaveProperty("targetRange");
            expect(botState).toHaveProperty("rangeId");
            expect(botState.targetRange).toHaveProperty("min");
            expect(botState.targetRange).toHaveProperty("max");
            expect(bot.targetRangeSlots.get(1).has("bot1")).toBe(true);
        });
    });

    describe("handleCashout with slot release", () => {
        it("should release slot when bot cashes out", async () => {
            // Arrange
            const bot = initBot();
            bot.activeBots.set("bot1", {
                amount: 100,
                multiplier: 1.5,
                roundId: 1,
                rangeId: 1,
            });
            bot.botRate = 1.0;
            bot.recentBetConsumer.update = jest.fn().mockResolvedValue({});
            const mockUser = { id: "bot1", red: 1000, name: "Bot1" };
            userInfosRepository.findOneAndUpdate.mockResolvedValue(mockUser);
            bot.reserveSlot(1, "bot1");

            // Act
            await bot.handleCashout("bot1");

            // Assert
            expect(bot.targetRangeSlots.get(1).has("bot1")).toBe(false);
            expect(bot.activeBots.has("bot1")).toBe(false);
        });

        it("should release slot even if cashout fails", async () => {
            // Arrange
            const bot = initBot();
            bot.activeBots.set("bot1", {
                amount: 100,
                multiplier: 1.5,
                roundId: 1,
                rangeId: 1,
            });
            bot.botRate = 1.0;
            bot.recentBetConsumer.update = jest.fn().mockRejectedValue(new Error("Update failed"));
            userInfosRepository.findOneAndUpdate.mockRejectedValue(new Error("DB error"));
            bot.reserveSlot(1, "bot1");

            // Act & Assert - should throw error but slot should still be released
            await expect(bot.handleCashout("bot1")).rejects.toThrow("DB error");
            // Slot should be released even though error was thrown
            expect(bot.targetRangeSlots.get(1).has("bot1")).toBe(false);
            expect(bot.activeBots.has("bot1")).toBe(false);
        });

        it("should handle cashout when botState is null", async () => {
            // Arrange
            const bot = initBot();

            // Act
            await bot.handleCashout("bot1");

            // Assert
            expect(bot.activeBots.has("bot1")).toBe(false);
        });
    });

});
