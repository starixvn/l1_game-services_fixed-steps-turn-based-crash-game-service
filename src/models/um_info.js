import mongoose from "mongoose";

const schema = new mongoose.Schema({
    isPartnerUm: { type: Boolean, default: false },
    partnerId: { type: Number },
    finish: { type: Boolean },
    time: { type: Date },
});

export default function umInfo() {
    return mongoose.model("um_info", schema, "um_info");
}
