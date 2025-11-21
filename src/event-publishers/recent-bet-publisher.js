import { Core } from "sc-game-base";
import { Systems } from "sc-game-base/src/constants";

export default class RecentBetPublisher extends Core.BaseEventPublishers.BaseEventPublisher {
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
