import { Core } from "sc-game-base";
import { Systems } from "sc-game-base/src/constants";
import { BigWinConsumer } from "../consumers";

export default class RecentBigWinPublisher extends Core.BaseEventPublishers.BaseEventPublisher {
    /**
     * @param {string} gameName
     * @param {GameData} gameData
     * @param {BigWinConsumer} bigWinConsumer
     */

    constructor(gameName, gameData, bigWinConsumer) {
        super(gameName, gameData);

        this.bigWinConsumer = bigWinConsumer;
    }

    publish(recentBigWinningWinner) {
        const players = Object.values(this.gameData.realPlayers).filter((player) => player.session?.system !== Systems.Mobi);

        players.forEach((player) => {
            const socket = player.socketClient;
            this.bigWinConsumer.updateExchangeRateCode(player, [recentBigWinningWinner]);
            socket.emit(this.gameName, { recentBigWinningWinner });
        });
    }
}
