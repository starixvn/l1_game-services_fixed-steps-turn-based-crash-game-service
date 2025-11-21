import mongoose from "mongoose";
import GameData from "../game-data";
const MAX_RECENT_BETS_RECORDS = 10;

export default class RecentBetConsumer {
    /**
     * @param {mongoose.Model} recentBetsRepository
     * @param {GameData} gameData
     */
    constructor(recentBetsRepository, gameData) {
        this.recentBetsRepository = recentBetsRepository;
        this.gameData = gameData;
    }
    /**
     * @param {Object} player
     * @param {Object} data
     * @param {number} data.roundId
     * @param {number} data.amount
     * @param {number} data.baseAmount
     * @param {number} data.rate
     */
    async add(player, { roundId, amount, baseAmount, rate }) {
        const recentBet = {
            roundId,
            name: player.profile.name,
            amount,
            baseAmount,
            rate,
            time: new Date(),
            exchangeRateId: this.gameData.exchangeRates.exId,
        };

        const document = { ...recentBet };

        if (!!player.session) {
            document.uid = player.UID;
            document.currency = player.session.currencyName;
            document.operatorId = player.session.operatorId;
            document.playerId = player.session.playerId;
            recentBet.playerId = player.session.playerId;
        }

        await this.recentBetsRepository.create(document);
        return recentBet;
    }

    /**
     * @param {Object} data
     * @param {number} data.roundId
     * @param {number} data.winningAmount
     * @param {number} data.baseWinningAmount
     * @param {number} data.multiplier
     */
    async update({ roundId, winningAmount, baseWinningAmount, multiplier }) {
        return await this.recentBetsRepository.findOneAndUpdate(
            { roundId },
            { $set: { multiplier, winningAmount, baseWinningAmount } },
            { new: true, lean: true, select: "-_id -uid -__v -playerId -operatorId" }
        );
    }
    /**
     * @param {Object} realPlayer
     * @returns {Object[]}
     */
    async getRecentBets(realPlayer) {
        const recentBets = await this.recentBetsRepository
            .find({}, { _id: false, uid: false, roundId: false, currency: false, operatorId: false, __v: false })
            .lean()
            .sort({ time: -1 })
            .limit(MAX_RECENT_BETS_RECORDS);

        if (recentBets.length === 0) {
            return [];
        }
        return recentBets.reverse();
    }

    updateRecentBetExchangeRateCode(bet, currencyCode, exchangeRates) {
        const exchangeRate = exchangeRates.find((er) => er.exId === bet.exchangeRateId);

        if (!exchangeRate) {
            return;
        }
        bet.exchangeRateCode = {
            [currencyCode]: parseFloat(exchangeRate.code[currencyCode]),
        };
    }
}
