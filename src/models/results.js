import mongoose from "mongoose";

const resultSchema = new mongoose.Schema({
    roundId: { type: Number, required: true },
    serverSeedHash: { type: String },
    mergeClientSeed: { type: String },
    encryptedFinalResult: { type: Object },
    encryptedServerSeed: { type: Object },
    encryptedFinalHash: { type: Object },
    time: { type: Date, default: new Date() },
});

export default function (gameConfigName) {
    return mongoose.model(`${gameConfigName}_results`, resultSchema);
}
