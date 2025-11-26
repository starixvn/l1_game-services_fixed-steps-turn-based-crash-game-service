import mongoose from "mongoose";
import RecentBetPublisher from "../event-publishers/recent-bet-publisher";
import GameData from "../game-data";
const MAX_RECENT_BETS_RECORDS = 10;

export default class RecentBetConsumer {
    /**
     * @param {Object} dependencies
     * @param {mongoose.Model} dependencies.recentBetsRepository
     * @param {GameData} dependencies.gameData
     * @param {mongoose.Model} dependencies.exchangeRatesRepository
     * @param {RecentBetPublisher} dependencies.recentBetPublisher
     */
    constructor({ recentBetsRepository, gameData, exchangeRatesRepository, recentBetPublisher }) {
        this.recentBetsRepository = recentBetsRepository;
        this.gameData = gameData;
        this.exchangeRatesRepository = exchangeRatesRepository;
        this.recentBetPublisher = recentBetPublisher;
    }
    /**
     * @param {Object} player
     * @param {Object} data
     * @param {number} data.roundId
     * @param {number} data.amount
     * @param {number} data.baseAmount
     * @param {number} data.rate
     */
    async add(player, { roundId, amount, baseAmount, rate, winningAmount, baseWinningAmount, multiplier }) {
        const recentBet = {
            roundId,
            name: player.profile.name,
            amount,
            baseAmount,
            rate,
            winningAmount,
            baseWinningAmount,
            multiplier,
            time: new Date(),
            exchangeRateId: this.gameData.exchangeRates.exId,
        };

        const document = {
            uid: player.UID,
            ...recentBet,
        };

        if (!!player.session) {
            document.currency = player.session.currencyName;
            document.operatorId = player.session.operatorId;
            document.playerId = player.session.playerId;
            recentBet.playerId = player.session.playerId;
        }

        await this.recentBetsRepository.create(document);
        this.recentBetPublisher.publish(recentBet);
    }

    /**
     * @param {Object} data
     * @param {number} data.roundId
     * @param {number} data.winningAmount
     * @param {number} data.baseWinningAmount
     * @param {number} data.multiplier
     */
    async update({ roundId, winningAmount, baseWinningAmount, multiplier }) {
        const recentBet = await this.recentBetsRepository.findOneAndUpdate(
            { roundId },
            { $set: { multiplier, winningAmount, baseWinningAmount } },
            { new: true, lean: true, select: "-_id -uid -__v -playerId -operatorId" }
        );
        if (recentBet) {
            this.recentBetPublisher.publish(recentBet);
        }
    }
    /**
     * @param {Object} realPlayer
     * @returns {Object[]}
     */
    async getRecentBets() {
        const recentBets = await this.recentBetsRepository
            .find({}, { _id: false, uid: false, currency: false, operatorId: false, __v: false })
            .lean()
            .sort({ time: -1 })
            .limit(MAX_RECENT_BETS_RECORDS);

        if (recentBets.length === 0) {
            return [];
        }
        return recentBets;
    }
}
