import getSSOToken from "./sso-handler";
import { authorize } from "./authorize-handler.js";
import { joinGame, placeBet } from "./socket-handler";
import config from "../config";

const autoPlaceBet = (socket, gameInfo) => {
    const { betAmount } = config.testConfig;
    let isPlaceBet = false;

    socket.on("Spaceflight", (data) => {
        if (data.spb) {
            setTimeout(async () => {
                isPlaceBet = true;
                await placeBet(socket, { amount: betAmount, clientSeed: "1234", clientSendTime: new Date() }, gameInfo);
            }, 1000);
        }

        if (isPlaceBet && data.m > 1.5) {
            socket.emit("cashOut", { halfCashOut: false });
            isPlaceBet = false;
        }
    });
};

export default async function (playerId, gameInfo) {
    try {
        const ssoToken = await getSSOToken(playerId);
        const authorizeInfo = await authorize(ssoToken);

        const socket = await joinGame(gameInfo, authorizeInfo);

        socket && autoPlaceBet(socket, gameInfo);
    } catch (e) {
        console.log(e);
    }
}
