import { Core } from "sc-game-base";
import { Systems } from "sc-game-base/src/constants";

export default class RecentBetPublisher extends Core.BaseEventPublishers.BaseEventPublisher {
    /**
     * @param {string} gameName
     * @param {GameData} gameData
     */

    constructor(gameName, gameData) {
        super(gameName, gameData);

    }

    publish(recentBet) {
        if (!recentBet) {
            return;
        }

        const players = Object.values(this.gameData.realPlayers).filter((player) => player.session?.system !== Systems.Mobi);

        players.forEach((player) => {
            const socket = player.socketClient;
            socket.emit(this.gameName, { recentBet });
        });
    }
}
