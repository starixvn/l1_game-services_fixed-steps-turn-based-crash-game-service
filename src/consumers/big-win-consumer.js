import mongoose from "mongoose";
import GameData from "../game-data";
const MAX_BIG_WINS_RECORDS = 10;

export default class BigWinConsumer {
    /**
     * @param {mongoose.Model} bigWinsRepository
     * @param {GameData} gameData
     * @param {mongoose.Model} exchangeRatesRepository
     */
    constructor(bigWinsRepository, gameData, exchangeRatesRepository) {
        this.bigWinsRepository = bigWinsRepository;
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
        const bigWin = {
            name: player.profile.name,
            amount,
            baseAmount,
            rate,
            time: new Date(),
            exchangeRateId: this.gameData.exchangeRates.exId,
        };

        const document = {
            roundId,
            uid: player.UID,
            ...bigWin,
        };

        if (!!player.session) {
            document.currency = player.session.currencyName;
            document.operatorId = player.session.operatorId;
            document.playerId = player.session.playerId;
            bigWin.playerId = player.session.playerId;
        }

        await this.bigWinsRepository.create(document);
        return bigWin;
    }

    /**
     * @param {Object} data
     * @param {number} data.roundId
     * @param {number} data.winningAmount
     * @param {number} data.baseWinningAmount
     * @param {number} data.multiplier
     */
    async updateBigWin({ roundId, winningAmount, baseWinningAmount, multiplier }) {
        return await this.bigWinsRepository.findOneAndUpdate(
            { roundId },
            { $set: { multiplier, winningAmount, baseWinningAmount } },
            { new: true, lean: true, select: "-_id -uid -__v -playerId -operatorId" }
        );
    }
    /**
     * @param {Object} realPlayer
     * @returns {Object[]}
     */
    async getRecentBigWinningWinners(realPlayer) {
        const bigWins = await this.bigWinsRepository
            .find({}, { _id: false, uid: false, roundId: false, currency: false, operatorId: false, __v: false })
            .lean()
            .sort({ time: -1 })
            .limit(MAX_BIG_WINS_RECORDS);

        if (bigWins.length === 0) {
            return [];
        }
        await this.updateExchangeRateCode(realPlayer, bigWins);
        return bigWins.reverse();
    }

    /**
     * @param {Object} realPlayer
     * @param {Object[]} winners
     */
    async updateExchangeRateCode(realPlayer, winners) {
        const exchangeRates = await this.getExchangeRates(winners.map((w) => w.exchangeRateId));
        const { session } = realPlayer;
        for (const winner of winners) {
            this.updateBigWinExchangeRateCode(winner, session.currencyCode, exchangeRates);
        }
    }

    updateBigWinExchangeRateCode(winner, currencyCode, exchangeRates) {
        const exchangeRate = exchangeRates.find((er) => er.exId === winner.exchangeRateId);

        if (!exchangeRate) {
            return;
        }
        winner.exchangeRateCode = {
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
