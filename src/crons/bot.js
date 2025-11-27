import Chance from "chance";
import { helpers, logger } from "sc-common";
import { Table } from "sc-game-base";
import { SeedHelper, ServerSeedHelper } from "sc-game-base/src/core/helpers";
import * as util from "util";
import { Actions } from "../constants";
import { RecentBetConsumer } from "../consumers";
import { getNextMultiplier } from "../helpers/crash-point-helper";

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
    }

    async run() {
        if (!this.gameData.gameConfigs?.botenabled) {
            return;
        }

        this.clearTimeouts();

        const random = this.chance.integer({ min: 0, max: 5 });

        if (this.shouldAddBot(random)) {
            await this.joinRoom();
        }

        if (this.shouldRemoveBot(random)) {
            await this.leaveRoom();
        }

        const botIds = Object.keys(this.botsInRoom);
        botIds.forEach((botId) => {
            const delay = this.chance.integer({ min: 0, max: 800 });
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

            this.activeBots.set(botId, {
                amount: betAmount,
                result,
                multiplier,
                tapCount: 1,
                lastActionTime: Date.now(),
                multiplierMode,
                roundId,
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
            const isBet = this.chance.bool({ likelihood: 30 });
            action = isBet ? Actions.Bet : null;
        } else {
            const multiplier = botState.multiplier;
            const mineWeight = Math.max(0, 50 - multiplier * 2);
            const cashOutWeight = 40 + multiplier * 5;
            const waitWeight = 35 + multiplier * 5;
            action = this.chance.weighted([Actions.Mine, Actions.CashOut, null], [mineWeight, cashOutWeight, waitWeight]);
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

        const multiplier = botState.multiplier;
        const rate = this.botRate;
        const amount = botState.amount;
        const winningAmount = multiplier * amount;
        const baseWinningAmount = winningAmount * rate;

        const roundId = botState.roundId;
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

        this.activeBots.delete(botId);
    }

    resetBot(bot) {
        this.clearTimeouts();
        super.resetBot(bot);
        this.activeBots.delete(bot.id);
    }

    async removeBot(botId) {
        this.clearTimeouts();
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
}
