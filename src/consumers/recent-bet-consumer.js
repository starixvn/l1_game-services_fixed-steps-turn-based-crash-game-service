import mongoose from "mongoose";
import GameData from "../game-data";
const MAX_RECENT_BETS_RECORDS = 10;

export default class RecentBetConsumer {
    /**
     * @param {mongoose.Model} recentBetsRepository
     * @param {GameData} gameData
     * @param {mongoose.Model} exchangeRatesRepository
     */
    constructor(recentBetsRepository, gameData, exchangeRatesRepository) {
        this.recentBetsRepository = recentBetsRepository;
        this.gameData = gameData;
        this.exchangeRatesRepository = exchangeRatesRepository;
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
        await this.updateExchangeRateCode(realPlayer, recentBets);
        return recentBets.reverse();
    }

    /**
     * @param {Object} realPlayer
     * @param {Object[]} bets
     */
    async updateExchangeRateCode(realPlayer, bets) {
        const exchangeRates = await this.getExchangeRates(bets.map((bet) => bet.exchangeRateId));
        const { session } = realPlayer;
        for (const bet of bets) {
            this.updateRecentBetExchangeRateCode(bet, session.currencyCode, exchangeRates);
        }
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

    /**
     * @param {number[]} exIds
     * @returns {Object[]}
     */
    async getExchangeRates(exIds) {
        const filter = {
            exId: { $in: exIds },
        };
        const projection = {
            _id: false,
            exId: true,
            code: true,
        };

        return this.exchangeRatesRepository.find(filter, projection).lean().exec();
    }
}
