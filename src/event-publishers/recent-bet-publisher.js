import { Core } from "sc-game-base";
import { Systems } from "sc-game-base/src/constants";
import { RecentBetConsumer } from "../consumers";

export default class RecentBetPublisher extends Core.BaseEventPublishers.BaseEventPublisher {
    /**
     * @param {string} gameName
     * @param {GameData} gameData
     * @param {RecentBetConsumer} recentBetConsumer
     */

    constructor(gameName, gameData, recentBetConsumer) {
        super(gameName, gameData);

        this.recentBetConsumer = recentBetConsumer;
    }

    publish(recentBet) {
        if (!recentBet) {
            return;
        }

        const players = Object.values(this.gameData.realPlayers).filter((player) => player.session?.system !== Systems.Mobi);

        players.forEach((player) => {
            const socket = player.socketClient;
            this.recentBetConsumer.updateExchangeRateCode(player, [recentBet]);
            socket.emit(this.gameName, { recentBet });
        });
    }
}
