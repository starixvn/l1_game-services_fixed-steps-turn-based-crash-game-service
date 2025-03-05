import { io } from "socket.io-client";
import { userAgent } from "../constants/constants";
import config from "../config";

const promiseTimeOut = 5000;

export const joinGame = async (gameInfo, authorizeInfo) => {
    const socket = await connectSocket(gameInfo);
    const signInSuccessful = await requestSignIn(socket, authorizeInfo);
    const inGameSuccessful = await requestInGame(socket, gameInfo);

    if (signInSuccessful && inGameSuccessful) {
        return socket;
    } else {
        return false;
    }
};

export const placeBet = async (socket, betInfo, gameInfo) =>
    new Promise((resolve, reject) => {
        socket.emit("bet", betInfo);

        socket.on(gameInfo.name, (data) => {
            if (data.endBet > 0) {
                resolve(true);
            }

            if (data.endBet === -1) {
                console.log(data);
                resolve(false);
            }
        });
    });

const connectSocket = async (gameInfo) =>
    new Promise((resolve, reject) => {
        const socketOptions = {
            forceNew: true,
            transports: ["websocket"],
            upgrade: false,
            path: gameInfo.proxyRoute,
            extraHeaders: {
                "user-agent": userAgent,
            },
        };

        const uri = `${config.proxy}/user/${gameInfo.name.toLowerCase()}`;

        const socket = io(uri, socketOptions);

        socket.on("Spaceflight", (data) => {
            console.log(data);
        });

        socket.on("connect", () => {
            resolve(socket);
        });

        socket.on("connect_error", (error) => {
            reject(error);
        });

        setTimeout(() => {
            reject("socket - time out");
        }, promiseTimeOut);
    });

const requestSignIn = async (socket, authorizeInfo) =>
    new Promise((resolve, reject) => {
        socket.emit("signin", authorizeInfo);

        socket.on("signedIn", () => {
            resolve(true);
        });

        socket.on("toGame", () => {
            resolve(true);
        });

        socket.on("message", (data) => {
            if (data.unauthorized || data.notPermittedToPlay) {
                resolve(false);
            }
        });

        setTimeout(() => {
            reject("signIn - time out");
        }, promiseTimeOut);
    });

const requestInGame = async (socket, gameInfo) =>
    new Promise((resolve, reject) => {
        socket.emit("inGame");

        socket.on(gameInfo.name, (data) => {
            if (data.gameConfigs) {
                console.log(JSON.stringify(data.roundHistory));
                resolve(true);
            }

            setTimeout(() => {
                reject("inGame - time out");
            }, promiseTimeOut);
        });
    });
