import mongoose from "mongoose";

const schema = new mongoose.Schema({
    uid: { type: String, required: true },
    name: { type: String, required: true },

    amount: { type: Number, default: 0 },
    betWin: { type: Number, default: 0 },
    time: { type: Date },

    siteId: { type: String },
    freeBet: { type: Boolean, default: false },

    currency: { type: String, required: true },
    rate: { type: Number, required: true },

    playerId: { type: String },
    operatorId: { type: String, required: true },
    roundId: { type: Number, default: 0, required: true },
    paid: { type: Boolean, default: false },

    autoCashOut: { type: Number },
    clientSeed: { type: String },
    totalAmount: { type: Number, default: 0 },

    tapCount: { type: Number, required: true },
    exchangeRateId: { type: Number, required: true },
    odds: { type: Object, required: true },
});

export function tempBets(gameConfigName) {
    return mongoose.model(`${gameConfigName}_tmpbets`, schema);
}

export default function (gameConfigName) {
    return mongoose.model(`${gameConfigName}_bets`, schema);
}
