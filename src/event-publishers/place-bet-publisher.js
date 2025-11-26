import { Table } from "sc-game-base";

export default class PlaceBetPublisher extends Table.EventPublishers.TablePlaceBetPublisher {
    publishMineResult(playerId, payload) {
        this.publishToUser(playerId, payload);
    }

    publishSuccessBet(playerId, payload) {
        this.publishToUser(playerId, payload);
    }
}
