import config from "../config";

const userAgent = "axios/0.27.2";

const SystemInfo = {
    SC1: {
        auth: {
            operatorId: "ONEworks1",
            operatorSecret: "ONEworks1@20luminet&",
        },
        currency: "$US",
    },
    VG2: {
        auth: {
            operatorId: "ONEworksVGCash",
            operatorSecret: "VG@SC123",
        },
        currency: "INH",
    },
};

const playerIdPrefix = 999;

const PlayerIds = [...Array(config.testConfig.totalUsers).keys()].map(
    (value) => `${playerIdPrefix}${String(value).padStart(Math.floor(config.testConfig.totalUsers.toString().length), "0")}`
);

export { userAgent, PlayerIds, SystemInfo };
