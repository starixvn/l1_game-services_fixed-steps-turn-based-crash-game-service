import mongoose from "mongoose";

const Schema = new mongoose.Schema({
    id: { type: Number, required: true },
    time: { type: Date, default: new Date() },
    exchangeRateId: { type: Number, required: true },
    name: { type: String, required: true },
    memberId: { type: String, required: true },
    currency: { type: String, required: true },
    amount: { type: Number, required: true },
    odds: { type: Object, required: true },
    betWin: { type: Number },
    result: { type: Array },
    settlementResult: { type: Array },
    paid: { type: Boolean, default: false },
    tapCount: { type: Number, default: 0 },
});

export default function (gameConfigName) {
    return mongoose.model(`${gameConfigName}_leader_boards`, Schema);
}
