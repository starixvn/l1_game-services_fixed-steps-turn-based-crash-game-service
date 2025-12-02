import Chance from "chance";
import { helpers, logger } from "sc-common";
import { Table } from "sc-game-base";
import { SeedHelper, ServerSeedHelper } from "sc-game-base/src/core/helpers";
import * as util from "util";
import { Actions } from "../constants";
import { RecentBetConsumer } from "../consumers";
import { getNextMultiplier } from "../helpers/crash-point-helper";

// Target range status constants
const RangeStatus = {
    BELOW: "below",
    WITHIN: "within",
    ABOVE: "above",
};

// Target range configuration
const TARGET_RANGES = [
    { id: "range1", min: 1.01, max: 2.0, ratio: 0.45 },
    { id: "range2", min: 2.1, max: 4.0, ratio: 0.15 },
    { id: "range3", min: 4.1, max: 5.0, ratio: 0.15 },
    { id: "range4", min: 5.1, max: 7.0, ratio: 0.15 },
    { id: "range5", min: 7.1, max: Infinity, ratio: 0.05 }, // Will be updated to dynamic
];

export default class Bot extends Table.Crons.TableGameBot {
    /**
     * @param {RecentBetConsumer} recentBetConsumer
     */
    constructor(definition, gameData, publisher, userInfosRepository, recentBetConsumer) {
        super(definition, gameData, publisher, userInfosRepository);
        this.chance = new Chance();
        this.activeBots = new Map();
        this.minBotsAtTheTable = 4;
        this.maxBotsAtTheTable = 8;
        this.activeTimeouts = new Set();
        this.recentBetConsumer = recentBetConsumer;
        // Slot management: Map<rangeId, Set<botId>>
        this.targetRangeSlots = new Map();
        // Initialize slot tracking for each range
        TARGET_RANGES.forEach((range) => {
            this.targetRangeSlots.set(range.id, new Set());
        });

        // Performance optimization caches
        this.targetRangeSlotsCache = null;
        this.targetRangeSlotsCacheKey = null;
        this.randomNumberPool = []; // Pool of pre-generated random numbers
        this.randomPoolSize = 1000;
        this.randomPoolIndex = 0;
        this.preGenerateRandomNumbers();
    }

    async run() {
        if (!this.gameData.gameConfigs?.botenabled) {
            return;
        }

        this.clearTimeouts();

        const random = Math.floor(this.getPooledRandom(0, 5));

        if (this.shouldAddBot(random)) {
            await this.joinRoom();
        }

        if (this.shouldRemoveBot(random)) {
            await this.leaveRoom();
        }

        const botIds = Object.keys(this.botsInRoom);
        botIds.forEach((botId) => {
            const delay = Math.floor(this.getPooledRandom(0, 800));
            const timeout = setTimeout(() => {
                this.handleBotActions(botId).catch((error) => {
                    logger.logError(`Error handling bot action for ${botId}: ${util.inspect(error)}`);
                });
                this.activeTimeouts.delete(timeout);
            }, delay);
            this.activeTimeouts.add(timeout);
        });
    }

    clearTimeouts() {
        for (const timeout of this.activeTimeouts) {
            clearTimeout(timeout);
        }
        this.activeTimeouts.clear();
    }

    async placeBet(botId) {
        const maxBet = this.getMaxBet(this.botsInRoom[botId]);
        const minBet = this.getMinBet();
        const betAmount = this.convertAmountToChip(helpers.numberHelper.getRandomNumberStep5(minBet, maxBet, false));

        const user = await this.userInfosRepository.findOneAndUpdate(
            { id: botId, red: { $gt: betAmount } },
            { $inc: { red: -betAmount } },
            { new: true, lean: true }
        );

        if (user) {
            const roundId = (this.gameData.roundId += 1);
            const serverSeed = ServerSeedHelper.generateServerSeed();
            const finalHash = SeedHelper.getSHA512Hash(serverSeed);
            const result = this.definition.generateResult(finalHash);

            const multiplierMode = this.chance.integer({ min: 1, max: 4 });
            const currentMultiplierConfig = this.gameData.gameConfigs.crashConfig.fixedStepsMultiplierConfigs.find(
                (config) => config.mode === multiplierMode
            );
            const firstMultiplier = currentMultiplierConfig.multiplierSteps[0];
            const multiplier = result > firstMultiplier ? firstMultiplier : 0;
            user.profile = { name: user.name };

            // Assign target range and reserve slot
            const targetRange = this.assignTargetRange(botId, multiplierMode);

            this.activeBots.set(botId, {
                amount: betAmount,
                result,
                multiplier,
                tapCount: 1,
                lastActionTime: Date.now(),
                multiplierMode,
                roundId,
                targetRange,
                rangeId: targetRange.rangeId,
            });

            const rate = this.botRate;
            const baseAmount = betAmount * rate;
            await this.recentBetConsumer.add(user, {
                roundId,
                amount: betAmount,
                baseAmount,
                rate,
            });

            if (multiplier === 0) {
                await this.handleCashout(botId);
            }
        }
    }

    async handleBotActions(botId) {
        try {
            const action = this.getAction(botId);

            switch (action) {
                case Actions.Bet:
                    await this.placeBet(botId);
                    break;
                case Actions.Mine:
                    await this.handleMining(botId);
                    break;
                case Actions.CashOut:
                    await this.handleCashout(botId);
                    break;
            }
        } catch (error) {
            logger.logError(error);
        }
    }

    getRemovalBotIds(totalRemoval) {
        const botIds = Object.keys(this.botsInRoom).filter((botId) => !this.activeBots.has(botId));
        if (!this.removeBotAtTheTable) {
            this.removeBotAtTheTable = true;

            const botsOnTable = botIds?.length > 8 ? botIds.slice(0, 8) : botIds;

            return botsOnTable?.length > 3 ? this.chance.pickset(botsOnTable, this.chance.integer({ min: 1, max: 3 })) : botsOnTable;
        }

        return botIds?.length > totalRemoval ? this.chance.pickset(Object.keys(this.botsInRoom), totalRemoval) : botIds;
    }

    getAction(botId) {
        const botState = this.activeBots.get(botId);
        let action = null;

        if (!botState) {
            const isBet = this.chance.bool({ likelihood: 10 });
            action = isBet ? Actions.Bet : null;
        } else {
            const multiplier = botState.multiplier;
            const targetRange = botState.targetRange;
            const rangeStatus = this.isInTargetRange(multiplier, targetRange);

            if (rangeStatus === RangeStatus.BELOW) {
                // Below target range: randomly pick between mine and wait
                action = this.chance.bool({ likelihood: 60 }) ? Actions.Mine : null;
            } else if (rangeStatus === RangeStatus.WITHIN) {
                // Within target range: randomly pick between cash out, mine, and wait
                action = this.chance.weighted(
                    [Actions.CashOut, Actions.Mine, null],
                    [35, 40, 25] // 35% cash out, 40% mine, 25% wait
                );
            } else {
                // Above target range: must cash out
                action = Actions.CashOut;
            }
        }

        return action;
    }

    async handleMining(botId) {
        const botState = this.activeBots.get(botId);
        const fixedStepsMultiplierConfigs = this.gameData.gameConfigs.crashConfig.fixedStepsMultiplierConfigs;
        const currentMultiplierConfig = fixedStepsMultiplierConfigs.find((config) => config.mode === botState.multiplierMode);
        let updatedMultiplier = getNextMultiplier(botState.multiplier, currentMultiplierConfig);
        updatedMultiplier = updatedMultiplier > 1000 || updatedMultiplier > botState.result ? 0 : updatedMultiplier;
        botState.hasMined = true;
        botState.lastActionTime = Date.now();
        botState.multiplier = updatedMultiplier;
        botState.tapCount++;
        this.activeBots.set(botId, botState);

        const maxMultiplier = currentMultiplierConfig.multiplierSteps.at(-1);

        if (updatedMultiplier === 0 || updatedMultiplier === maxMultiplier) {
            await this.handleCashout(botId);
        }
    }

    async handleCashout(botId) {
        const botState = this.activeBots.get(botId);
        if (!botState) {
            return;
        }

        const multiplier = botState.multiplier;
        const rate = this.botRate;
        const amount = botState.amount;
        const winningAmount = multiplier * amount;
        const baseWinningAmount = winningAmount * rate;

        const roundId = botState.roundId;
        const rangeId = botState.rangeId;

        try {
            const user = await this.userInfosRepository.findOneAndUpdate({ id: botId }, { $inc: { red: +winningAmount } });

            if (this.gameData.players[botId]) {
                this.gameData.players[botId].red = user.red;
                user.profile = { name: user.name };
            }

            await this.recentBetConsumer.update({
                roundId,
                winningAmount,
                baseWinningAmount,
                multiplier,
            });
        } finally {
            // Always release the slot, even if cashout fails
            this.releaseSlot(rangeId, botId);
            this.activeBots.delete(botId);
        }
    }

    resetBot(bot) {
        this.clearTimeouts();
        const botState = this.activeBots.get(bot.id);
        if (botState && botState.rangeId) {
            this.releaseSlot(botState.rangeId, bot.id);
        }
        super.resetBot(bot);
        this.activeBots.delete(bot.id);
    }

    async removeBot(botId) {
        this.clearTimeouts();
        const botState = this.activeBots.get(botId);
        if (botState && botState.rangeId) {
            this.releaseSlot(botState.rangeId, botId);
        }
        this.activeBots.delete(botId);
        await super.removeBot(botId);
    }

    getMaxBet(bot) {
        const maxBet = bot.profile?.maxBet || this.gameData.gameConfigs.maxbet;
        return Math.min(maxBet, bot.red, this.gameData.gameConfigs.bot_maxbet);
    }

    getBetChoice() {
        return Actions.Bet;
    }

    getBotsToJoin(botUsers) {
        const remaining = this.maxNumberOfBots - Object.keys(this.botsInRoom).length;
        if (remaining < 1) {
            return [];
        }

        const numberOfBotsToJoin = this.chance.integer({ min: 1, max: remaining });
        const shuffleBots = this.chance.shuffle(botUsers);

        return shuffleBots.slice(0, numberOfBotsToJoin);
    }

    /**
     * Calculate available slots for each range based on bots in room
     * @param {number} multiplierMode - The multiplier mode for calculating range5 max
     * @returns {Array} Array of ranges with available slots
     */
    getTargetRangeSlots(multiplierMode) {
        const totalBots = Object.keys(this.botsInRoom).length;
        const cacheKey = this.generateCacheKey(totalBots);

        // Return cached result if valid
        if (this.targetRangeSlotsCache && this.targetRangeSlotsCacheKey === cacheKey) {
            return this.targetRangeSlotsCache;
        }

        if (totalBots === 0) {
            this.targetRangeSlotsCache = [];
            this.targetRangeSlotsCacheKey = cacheKey;
            return [];
        }

        const result = TARGET_RANGES.map((range) => {
            const totalSlots = Math.max(1, Math.round(totalBots * range.ratio));
            const occupiedSlots = this.targetRangeSlots.get(range.id).size;
            const availableSlots = totalSlots - occupiedSlots;

            // Handle dynamic max for range5
            const max = range.max === "dynamic" ? this.getMaxMultiplier(multiplierMode) : range.max;

            return {
                ...range,
                max,
                totalSlots,
                occupiedSlots,
                availableSlots,
            };
        });

        // Cache the result
        this.targetRangeSlotsCache = result;
        this.targetRangeSlotsCacheKey = cacheKey;

        return result;
    }

    /**
     * Generate cache key for slot calculations
     * @param {number} totalBots - Total number of bots in room
     * @returns {string} Cache key
     */
    generateCacheKey(totalBots) {
        // Include occupied slots in cache key to detect changes
        const occupiedCounts = TARGET_RANGES.map(range =>
            this.targetRangeSlots.get(range.id).size
        ).join(',');
        return `${totalBots}:${occupiedCounts}`;
    }

    /**
     * Invalidate the target range slots cache
     */
    invalidateSlotCache() {
        this.targetRangeSlotsCache = null;
        this.targetRangeSlotsCacheKey = null;
    }

    /**
     * Reserve a slot in a target range for a bot
     * @param {string} rangeId - The range ID
     * @param {string} botId - The bot ID
     */
    reserveSlot(rangeId, botId) {
        const slots = this.targetRangeSlots.get(rangeId);
        if (slots && !slots.has(botId)) {
            slots.add(botId);
            this.invalidateSlotCache();
        }
    }

    /**
     * Release a slot in a target range for a bot
     * @param {string} rangeId - The range ID
     * @param {string} botId - The bot ID
     */
    releaseSlot(rangeId, botId) {
        if (!rangeId){
            return;
        }
        const slots = this.targetRangeSlots.get(rangeId);
        if (slots && slots.has(botId)) {
            slots.delete(botId);
            this.invalidateSlotCache();
        }
    }

    /**
     * Override joinRoom to invalidate cache when bots join
     */
    async joinRoom() {
        await super.joinRoom();
        this.invalidateSlotCache();
    }

    /**
     * Override leaveRoom to invalidate cache when bots leave
     */
    async leaveRoom() {
        await super.leaveRoom();
        this.invalidateSlotCache();
    }

    /**
     * Assign a target range to a bot and reserve a slot
     * @param {string} botId - The bot ID
     * @param {number} multiplierMode - The bot's multiplier mode for calculating range5 max (required)
     * @returns {Object|null} The assigned target range or null if no range available
     */
    assignTargetRange(botId, multiplierMode) {
        const availableRanges = this.getTargetRangeSlots(multiplierMode).filter((range) => range.availableSlots > 0);

        if (availableRanges.length === 0) {
            // Fallback: if no slots available, assign to first range
            const firstRange = TARGET_RANGES[0];
            this.reserveSlot(firstRange.id, botId);
            const max = firstRange.max === "dynamic" ? this.getMaxMultiplier(multiplierMode) : firstRange.max;
            return { rangeId: firstRange.id, min: firstRange.min, max };
        }

        // Weight selection by available slots (more available = higher chance)
        const weights = availableRanges.map((range) => range.availableSlots);
        const selectedRange = this.chance.weighted(availableRanges, weights);

        this.reserveSlot(selectedRange.id, botId);

        return {
            rangeId: selectedRange.id,
            min: selectedRange.min,
            max: selectedRange.max,
        };
    }

    /**
     * Check if multiplier is within target range
     * @param {number} multiplier - Current multiplier
     * @param {Object} targetRange - Target range with min and max
     * @returns {string} RangeStatus.BELOW, RangeStatus.WITHIN, or RangeStatus.ABOVE
     */
    isInTargetRange(multiplier, targetRange) {
        if (!targetRange){
            return RangeStatus.BELOW;
        }
        if (multiplier < targetRange.min){
            return RangeStatus.BELOW;
        }
        if (multiplier >= targetRange.min && multiplier <= targetRange.max){
            return RangeStatus.WITHIN;
        }
        return RangeStatus.ABOVE;
    }

    /**
     * Get maximum possible multiplier from game config for a specific mode
     * @param {number} multiplierMode - The multiplier mode to get max for
     * @returns {number} Maximum multiplier for the specified mode
     */
    getMaxMultiplier(multiplierMode) {
        const fixedStepsMultiplierConfigs = this.gameData.gameConfigs.crashConfig.fixedStepsMultiplierConfigs;

        // Get config for specific mode (mode is guaranteed to exist)
        const config = fixedStepsMultiplierConfigs.find((config) => config.mode === multiplierMode);

        // Return the last multiplier in the steps array (which is the maximum)
        return config.multiplierSteps.at(-1);
    }

    /**
     * Pre-generate a pool of random numbers for performance
     */
    preGenerateRandomNumbers() {
        this.randomNumberPool = [];
        for (let i = 0; i < this.randomPoolSize; i++) {
            this.randomNumberPool.push(this.chance.integer({ min: 0, max: 5 }));
        }
        this.randomPoolIndex = 0;
    }


    /**
     * Get next random number from the pre-generated pool
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random number
     */
    getPooledRandom(min = 0, max = 5) {
        if (this.randomPoolIndex >= this.randomNumberPool.length) {
            this.preGenerateRandomNumbers();
        }
        const randomValue = this.randomNumberPool[this.randomPoolIndex];
        this.randomPoolIndex++;

        // Scale the value to the requested range
        return min + (randomValue * (max - min)) / 5;
    }
}
