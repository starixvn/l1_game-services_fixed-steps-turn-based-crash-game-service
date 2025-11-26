import mongoose from "mongoose";

export default function (gameConfigName) {
    const recentBetSchema = new mongoose.Schema({
        uid: { type: String, required: true },
        name: { type: String, required: true },
        roundId: { type: Number, required: true },
        amount: { type: Number, required: true },
        baseAmount: { type: Number, required: true },
        winningAmount: { type: Number, default: 0 },
        baseWinningAmount: { type: Number, default: 0 },
        multiplier: { type: Number, default: 0 },
        time: { type: Date },
        currency: { type: String, required: false },
        rate: { type: Number, required: false },
        exchangeRateId: { type: Number, required: false },

        operatorId: { type: String, required: false },
        playerId: { type: String },
    });
    return mongoose.model(`${gameConfigName}_recentbets`, recentBetSchema);
}
