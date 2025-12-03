import mongoose from "mongoose";
import { BaseEventPublisher } from "sc-game-base/src/core/event-publishers";
import { Actions } from "../constants";
import { RecentBetPublisher } from "../event-publishers";
import helpers from "../helpers/notice-helper";
import RecentBetConsumer from "./recent-bet-consumer";
import { SettleGameRoundConsumer } from "./settle-game-round-consumer";

export class SettleCashOutConsumer {
    /**
     * @param {Object} dependencies
     * @param {GameData} dependencies.gameData
     * @param {SettleGameRoundConsumer} dependencies.settleGameRoundConsumer
     * @param {BaseEventPublisher} dependencies.publisher
     * @param {logger} dependencies.logService
     * @param {mongoose.Model} dependencies.betLogsRepository
     * @param {RecentBetConsumer} dependencies.recentBetConsumer
     * @param {RecentBetPublisher} dependencies.recentBetPublisher
     */
    constructor({ gameData, settleGameRoundConsumer, publisher, logService, betLogsRepository, recentBetConsumer, recentBetPublisher }) {
        this.gameData = gameData;
        this.settleGameRoundConsumer = settleGameRoundConsumer;
        this.publisher = publisher;
        this.logService = logService;
        this.betLogsRepository = betLogsRepository;
        this.recentBetConsumer = recentBetConsumer;
        this.recentBetPublisher = recentBetPublisher;
    }

    validateCashOut(player) {
        const playerData = this.gameData.ingame[player.profile.name];
        const betTracks = playerData?.betTracks;
        return betTracks?.[Actions.Bet];
    }

    async proceedCashOut({ player, isAutoCashOut = false }) {
        const isValidCashOut = this.validateCashOut(player) || isAutoCashOut;
        const bet = this.getCashOutBet(player);

        if (!isValidCashOut || !bet || !this.isValidCashOutBet(bet)) {
            this.publisher.publishToUser(player.UID, { endBet: -1, notice: helpers.invalidCashOut });

            return;
        }

        const { multiplier, roundId, tapCount, amount, multiplierMode } = bet;

        await this.insertBetLog(player, roundId, { multiplier, roundId, tapCount, amount, isAutoCashOut, multiplierMode });
        this.updateGameData(player, { multiplier, roundId, tapCount, multiplierMode });

        const winningAmount = await this.settleGameRoundConsumer.settleRound({
            roundId,
            time: new Date(),
            player,
            playerName: player.profile.name,
        });

        const rate = this.calculateCurrencyRate(player.session);
        const baseWinningAmount = winningAmount * rate;
        await this.recentBetConsumer.update({
            roundId,
            winningAmount,
            baseWinningAmount,
            multiplier,
        });
    }

    isValidCashOutBet(bet) {
        const { roundId, tapCount, amount, multiplierMode } = bet;

        return roundId && tapCount && amount && multiplierMode;
    }

    getCashOutBet(player) {
        const activeBet = this.gameData.ingame[player.profile.name].activeBet;

        if (!activeBet) {
            return null;
        }

        return {
            multiplier: activeBet.currentMultiplier,
            tapCount: activeBet.tapCount,
            roundId: activeBet.roundId,
            amount: activeBet.amount,
            multiplierMode: activeBet.multiplierMode,
        };
    }

    async updateGameData(player, bet) {
        const playerName = player.profile.name;
        const playerGameData = this.gameData.ingame[playerName];
        const playerBetTracks = playerGameData?.betTracks ?? {};

        playerBetTracks[Actions.CashOut] = {
            time: new Date(),
            multiplier: bet.multiplier,
            roundId: bet.roundId,
            tapCount: bet.tapCount,
            multiplierMode: bet.multiplierMode,
        };
    }

    async insertBetLog(player, roundId, bet) {
        const rate = this.calculateCurrencyRate(player.session);

        const newBetLog = {
            uid: player.UID,
            name: player.profile.name,
            time: new Date(),
            action: Actions.CashOut,
            amount: bet.amount,
            clientSendTime: bet.clientSendTime ?? new Date(),
            receivedTime: bet.receivedTime ?? new Date(),
            roundId,
            multiplier: bet.multiplier,
            winAmount: bet.amount * bet.multiplier,
            tapCount: bet.tapCount,
            isAutoCashOut: bet.isAutoCashOut,
            multiplierMode: bet.multiplierMode,
        };

        if (player.session) {
            newBetLog.siteId = player.session.siteId;
            newBetLog.currency = player.session.currencyName;
            newBetLog.currencyMultiplier = player.session.multiplier;
            newBetLog.rate = rate;
            newBetLog.currencyCode = player.session.currencyCode;
            newBetLog.operatorId = player.session.operatorId;
            newBetLog.playerId = player.session.playerId;
        }

        await this.betLogsRepository.create(newBetLog);
    }

    calculateCurrencyRate(session) {
        return session.multiplier * this.gameData.exchangeRates.code[session.currencyCode];
    }
}
