import { BaseEventConsumers } from "sc-game-base/src/core";
import { Actions, MaxDeltaTime } from "../constants";
import noticeHelper from "../helpers/notice-helper";

export class CashOutConsumer extends BaseEventConsumers.PlaceBetConsumer {
    consume(player, payload) {
        Object.assign(payload, {
            roundId: payload.roundId,
            m: payload.multiplier,
            clientSendTime: payload.clientSendTime,
            mode: payload.m ?? this.DisplayMode.Landscape,
            receivedTime: new Date(),
            action: Actions.CashOut,
        });

        const { roundId, clientSendTime, receivedTime } = payload;
        const name = player.profile.name;

        if (!this.validateRequest(player, roundId, clientSendTime, receivedTime)) {
            return;
        }

        this.adjustBetTracks(player.profile.name, payload);

        this.gameData.ingame[name].betQueue.push({ player, payload });
    }

    validateRequest(player, roundId, clientSendTime, receivedTime) {
        const criteria = this.composeValidationCriteria(roundId, player, clientSendTime, receivedTime);
        const failedCriterion = criteria.find((criterion) => criterion.failure);

        if (failedCriterion) {
            this.publisher.publishToUser(player.UID, { endBet: -1, notice: failedCriterion.notice });

            return false;
        }

        return true;
    }

    composeValidationCriteria(roundId, player, clientSendTime, receivedTime) {
        const name = player.profile.name;
        const betTracks = this.gameData.ingame?.[name]?.betTracks;

        const bettingTimeValidationCriteria = this.composeBettingTimeValidationCriteria(roundId, clientSendTime, receivedTime);
        const betTrackValidationCriteria = this.composeBetTrackValidationCriteria(betTracks);

        return bettingTimeValidationCriteria.concat(betTrackValidationCriteria);
    }

    composeBetTrackValidationCriteria(betTracks) {
        return [
            {
                failure: this.isNotHavingBet(betTracks) || this.isAlreadyCashout(betTracks),
                notice: this.getNoticeObj(noticeHelper.invalidCashOut),
            },
        ];
    }

    isNotHavingBet(betTracks) {
        return !betTracks?.[Actions.Bet]?.time;
    }

    isAlreadyCashout(betTracks) {
        return !!betTracks?.[Actions.CashOut]?.time;
    }

    composeBettingTimeValidationCriteria(roundId, clientSendTime, receivedTime) {
        const configs = this.gameData.gameConfigs;

        return [
            {
                failure: !configs.enabled,
                notice: this.getNoticeObj(noticeHelper.invalidCashOut),
            },
        ];
    }

    adjustBetTracks(playerName, bet) {
        const { receivedTime, action } = bet;

        if (this.gameData.ingame?.[playerName]) {
            const playerInGame = this.gameData.ingame[playerName];

            playerInGame.betTracks[action] = {
                time: receivedTime,
            };
        }
    }
}
