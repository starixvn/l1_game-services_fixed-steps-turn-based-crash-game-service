import { randomString } from "../helpers/random";
import axios from "axios";
import { userAgent, SystemInfo } from "../constants/constants";
import config from "../config";

export const getSSOToken = async (playerId) => {
    const systemInfo = SystemInfo[config.system];
    const requestBody = {
        playerId: playerId,
        playerName: randomString(8),
        language: "vi-VN",
        currency: systemInfo.currency,
        seq: "d,y,lumi",
        siteId: "4100300",
        siteName: "lumi",
        ip: "",
        browserUserAgent: userAgent,
        auth: systemInfo.auth,
        gameId: 0,
        domain: "example.com",
        appType: 1,
    };

    const result = await axios.post(`${config.simulatorUrl}/signin/sso`, requestBody);

    return result.data.token;
};

export const setDefaultBalance = async (playerId) => {
    const params = {
        operator: "ow",
        balance: 20000,
        systemType: "SC1",
    };

    return axios.post(
        `${config.owUrl}/SetDefaultBalance?playerId=${playerId}&operator=${params.operator}&balance=${params.balance}&systemType=${params.systemType}`
    );
};

export default getSSOToken;
