import mongoose from "mongoose";
import { Actions } from "../constants";
import helpers from "../helpers/notice-helper";
import { isBigWin } from "../helpers/result-helper";
import BigWinConsumer from "./big-win-consumer";
import { SettleGameRoundConsumer } from "./settle-game-round-consumer";
import { RecentBigWinPublisher } from "../event-publishers";

export class SettleCashOutConsumer {
    /**
     * @param {Object} dependencies
     * @param {GameData} dependencies.gameData
     * @param {SettleGameRoundConsumer} dependencies.settleGameRoundConsumer
     * @param {BaseEventPublisher} dependencies.publisher
     * @param {logger} dependencies.logService
     * @param {mongoose.Model} dependencies.betLogsRepository
     * @param {BigWinConsumer} dependencies.bigWinConsumer
     * @param {RecentBigWinPublisher} dependencies.recentBigWinPublisher
     */
    constructor({ gameData, settleGameRoundConsumer, publisher, logService, betLogsRepository, bigWinConsumer, recentBigWinPublisher }) {
        this.gameData = gameData;
        this.settleGameRoundConsumer = settleGameRoundConsumer;
        this.publisher = publisher;
        this.logService = logService;
        this.betLogsRepository = betLogsRepository;
        this.bigWinConsumer = bigWinConsumer;
        this.recentBigWinPublisher = recentBigWinPublisher;
    }

    validateCashOut(player) {
        const playerData = this.gameData.ingame[player.profile.name];
        const betTracks = playerData?.betTracks;
        const isHavingBet = betTracks?.[Actions.Bet];

        return isHavingBet;
    }

    async proceedCashOut(player, isAutoCashOut = false) {
        const isValidCashOut = this.validateCashOut(player) || isAutoCashOut;
        const bet = this.getCashOutBet(player);

        if (!isValidCashOut || !bet || !this.isValidCashOutBet(bet)) {
            this.publisher.publishToUser(player.UID, { endBet: -1, notice: helpers.invalidCashOut });

            return null;
        }

        const { multiplier, roundId, tapCount, amount } = bet;

        await this.insertBetLog(player, roundId, { multiplier, roundId, tapCount, amount, isAutoCashOut });
        this.updateGameData(player, { multiplier, roundId, tapCount });

        const winningAmount = await this.settleGameRoundConsumer.settleRound({
            roundId,
            time: new Date(),
            player,
            playerName: player.profile.name,
        });

        if (isBigWin(multiplier)) {
            const rate = this.calculateCurrencyRate(player.session);
            const baseAmount = amount * rate;
            const baseWinningAmount = winningAmount * rate;
            const recentBigWinningWinner = await this.bigWinConsumer.add(player, {
                roundId,
                amount,
                baseAmount,
                winningAmount,
                baseWinningAmount,
                multiplier,
                rate,
            });
            this.recentBigWinPublisher.publish(recentBigWinningWinner);
        }
        return { player, multiplier, roundId, tapCount, amount };
    }

    isValidCashOutBet(bet) {
        const { roundId, tapCount, amount } = bet;

        return roundId && tapCount && amount;
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
