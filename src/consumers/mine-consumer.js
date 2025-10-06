import { PlaceBetConsumer } from "sc-game-base/src/core/event-consumers";
import { Actions } from "../constants";
import { calculateIncrement, generateTapResult } from "../helpers/crash-point-helper";
import noticeHelper from "../helpers/notice-helper";
import { roundFloat } from "../helpers/number-helper";
import { SettleCashOutConsumer } from "./settle-cash-out-consumer";

export class MineConsumer extends PlaceBetConsumer {
    /**
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     * @param {BaseEventPublisher} publisher
     * @param {logger} logService
     * @param {mongoose.Model} betLogsRepository
     * @param {RoundResultConsumer} roundResultConsumer
     * @param {SettleCashOutConsumer} settleCashOutConsumer
     */
    constructor(definition, gameData, placeBetPublisher, logService, betLogsRepository, roundResultConsumer, settleCashOutConsumer) {
        super(definition, gameData, placeBetPublisher);
        this.logService = logService;
        this.betLogsRepository = betLogsRepository;
        this.roundResultConsumer = roundResultConsumer;
        this.settleCashOutConsumer = settleCashOutConsumer;
    }

    async mine(player, payload) {
        try {
            const validationResult = await this.validateMine(player, payload);

            if (!validationResult.isValid) {
                this.publishMineFailed(player, validationResult.error);
                return;
            }

            const playerName = player.profile.name;
            const playerGameData = this.gameData.ingame[playerName];
            const activeBet = playerGameData.activeBet;

            await this.handleMine(player, activeBet, payload);
        } catch (err) {
            this.logService.logError(err);
            this.publishMineFailed(player, noticeHelper.invalidMine);
        }
    }

    async validateMine(player, payload) {
        const playerName = player.profile.name;
        const playerGameData = this.gameData.ingame[playerName];

        if (!playerGameData?.betTracks[Actions.Bet]) {
            return {
                isValid: false,
                error: noticeHelper.noBetFound,
            };
        }

        if (playerGameData.betTracks[Actions.CashOut]) {
            return {
                isValid: false,
                error: noticeHelper.alreadyCashOut,
            };
        }

        return {
            isValid: true,
        };
    }

    async handleMine(player, activeBet, payload) {
        const playerName = player.profile.name;
        const ingameData = this.gameData.ingame[playerName];
        const provablyFair = this.gameData.provablyFair[playerName];
        const multiplier = ingameData.activeBet.currentMultiplier;
        const multiplierConfigs = this.gameData.gameConfigs.crashConfig.multiplierConfigs;
        const currentMultiplierConfig = multiplierConfigs.find((config) => config.mode === activeBet.multiplierMode);
        const increment = calculateIncrement(multiplier, currentMultiplierConfig);
        let updatedMultiplier = 0;

        const maxMultiplier = currentMultiplierConfig.values[currentMultiplierConfig.values.length - 1];

        if (multiplier < maxMultiplier) {
            updatedMultiplier = roundFloat(multiplier + increment);
            updatedMultiplier = updatedMultiplier > provablyFair.finalResult ? 0 : updatedMultiplier;
        }

        ingameData.activeBet.currentMultiplier = updatedMultiplier;
        ingameData.activeBet.tapCount++;
        const result = provablyFair.finalResult;

        await this.insertMineBetLog(player, activeBet, {
            clientSendTime: payload.clientSendTime,
            increment,
            result,
            updatedMultiplier,
        });

        this.updatePlayerGameState(playerName, updatedMultiplier);
        this.publisher.publishMineResult(player.UID, {
            multiplier: updatedMultiplier,
            winAmount: Math.min(updatedMultiplier * activeBet.amount, activeBet.maxWin),
            reachMaxWin: updatedMultiplier * activeBet.amount >= activeBet.maxWin,
        });

        if (updatedMultiplier === 0) {
            await this.settleCashOutConsumer.proceedCashOut(player, true);
        }
    }

    async insertMineBetLog(player, activeBet, { clientSendTime, increment, result, updatedMultiplier }) {
        const newBetLog = {
            uid: player.UID,
            name: player.profile.name,
            time: new Date(),
            action: Actions.Mine,
            amount: activeBet.amount,
            winAmount: activeBet.amount * updatedMultiplier,
            clientSendTime: clientSendTime,
            receivedTime: new Date(),
            freeBet: false,
            increment,
            result: generateTapResult(result),
            multiplier: updatedMultiplier,
            roundId: activeBet.roundId,
            multiplierMode: activeBet.multiplierMode,
        };

        if (player.session) {
            newBetLog.siteId = player.session.siteId;
            newBetLog.currency = player.session.currencyName;
            newBetLog.rate = player.session.multiplier * this.gameData.exchangeRates.code[player.session.currencyCode];
            newBetLog.currencyMultiplier = player.session.multiplier;
            newBetLog.currencyCode = player.session.currencyCode;
            newBetLog.operatorId = player.session.operatorId;
            newBetLog.playerId = player.session.playerId;
        }

        await this.betLogsRepository.create(newBetLog);
    }

    updatePlayerGameState(playerName, updatedMultiplier) {
        if (this.gameData.ingame?.[playerName]) {
            this.gameData.ingame[playerName].currentMultiplier = updatedMultiplier;
        }
    }

    publishMineFailed(player, errorCode) {
        this.publisher.publishGameFailedBet(player.UID, {
            endBet: -1,
            notice: { errorCode },
        });
    }
}
