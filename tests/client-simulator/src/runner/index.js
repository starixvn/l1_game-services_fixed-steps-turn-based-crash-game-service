import playerPlaceBet from "../handler/bet-handler";
import { PlayerIds } from "../constants/constants";
import { randomInt } from "../helpers/random";
import config from "../config";

export const start = async () => {
    const { gameNames, proxyRoute } = config.gameInfo;

    for (let playerIndex = 0; playerIndex < config.testConfig.totalUsers; playerIndex++) {
        const socketInfoIndex = randomInt(0, gameNames.length - 1);

        playerPlaceBet(PlayerIds[playerIndex], { name: gameNames[socketInfoIndex], proxyRoute });
    }
};
