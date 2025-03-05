import { Table } from "sc-game-base";
import { Systems } from "sc-game-base/src/constants/systems";

export default class PlaceBetPublisher extends Table.EventPublishers.TablePlaceBetPublisher {
    publishSuccessCashOut(playerId, payload, rate) {
        this.publishToUser(playerId, payload);
        this.publishToAllUsersExcept(playerId, { otherPlayer: { ...payload, rate } });
    }

    publishMineResult(playerId, payload) {
        this.publishToUser(playerId, payload);

        this.publishToAllUsersExceptSystem(Systems.Mobi, playerId, {
            playerMine: {
                playerId,
                ...payload,
            },
        });
    }

    publishSuccessBet(playerId, payload, rate) {
        this.publishToUser(playerId, payload);

        const otherUsersPayload = {
            playerId,
            rate,
            multiplier: payload.multiplier,
            amount: payload.amount,
            ...payload.user,
        };

        this.publishToAllUsersExceptSystem(Systems.Mobi, playerId, { playerChip: otherUsersPayload });
    }
}
