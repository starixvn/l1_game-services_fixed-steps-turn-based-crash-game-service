import axios from "axios";
import { userAgent } from "../constants/constants";
import config from "../config";

const userServiceUrl = `${config.proxy}/user`;

export const signName = async (authorizeInfo) => {
    const requestBody = {
        session: authorizeInfo.ss,
        username: authorizeInfo.username,
        nickname: `STest${authorizeInfo.username.split("_")[1]}`,
        browserUserAgent: userAgent,
        avatar: 0,
    };

    return axios.post(`${userServiceUrl}/auth/signName`, requestBody);
};

export const authorize = async (ssoToken) => {
    const result = await axios.get(`${userServiceUrl}/auth/sso?token=${ssoToken}&system=1`, {
        "user-agent": userAgent,
    });

    return result.data;
};
