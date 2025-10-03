import { Systems } from "sc-game-base/src/constants/systems";
import { EventConsumers } from "sc-game-base/src/table";
import { BigWinConsumer, ProvablyFairConsumer } from "./index";

export class InGameConsumer extends EventConsumers.TableInGameConsumer {
    /**
     * @param {Object} dependencies
     * @param {ProvablyFairConsumer} dependencies.provablyFairConsumer
     * @param {BigWinConsumer} dependencies.bigWinConsumer
     */

    constructor({ definition, gameData, roundQuery, publisher, getBalance, userInfosRepository, provablyFairConsumer, bigWinConsumer }) {
        super(definition, gameData, roundQuery, publisher, getBalance, userInfosRepository);
        this.provablyFairConsumer = provablyFairConsumer;
        this.bigWinConsumer = bigWinConsumer;
    }

    async consume(realPlayer) {
        const payload = await this.buildPayload(realPlayer);
        const player = {
            id: realPlayer.UID,
            name: realPlayer.profile.name,
            red: payload.user.red,
            avatarId: payload.user.avatarId,
            type: payload.user.type,
        };

        if (!this.gameData.players[realPlayer.UID]) {
            this.gameData.players[realPlayer.UID] = player;
        }

        realPlayer.socketClient.emit(this.definition.name, payload);
        this.provablyFairConsumer.generateServerSeedAndPublishHash(realPlayer.UID, realPlayer.profile.name);
        this.publisher.publishToAllUsersExceptSystem(Systems.Mobi, realPlayer.UID, { player });
    }

    async buildPayload(realPlayer) {
        const { session } = realPlayer;

        const settings = this.gameData.currencyGroupGames.find((x) => x.groupId.toString() === session.currencyGroupId);

        const { odds, enableFreeBet, crashConfig } = this.gameData.gameConfigs;
        const multiplierConfigs = [
            {
                mode: "easy",
                values: [
                    1.0, 1.04, 1.09, 1.14, 1.2, 1.26, 1.33, 1.41, 1.5, 1.6, 1.71, 1.85, 2.0, 2.18, 2.4, 2.67, 3.0, 3.43, 4.0, 4.8, 6.0, 8.0,
                    12.0, 24.0,
                ],
            },
            {
                mode: "medium",
                values: [
                    1.09, 1.25, 1.43, 1.66, 1.94, 2.28, 2.71, 3.25, 3.94, 4.85, 6.07, 7.72, 10.04, 13.38, 18.4, 26.29, 39.43, 63.09, 110.4,
                    220.8, 552.0, 2208.0,
                ],
            },
            {
                mode: "hard",
                values: [
                    1.2, 1.52, 1.94, 2.51, 3.29, 4.39, 5.95, 8.24, 11.68, 16.98, 25.48, 39.63, 64.4, 110.4, 202.4, 404.8, 910.8, 2428.8,
                    8500.8, 51004.8,
                ],
            },
            {
                mode: "hard core",
                values: [
                    1.6, 2.74, 4.85, 8.9, 16.98, 33.97, 71.71, 161.35, 391.86, 1044.96, 3134.87, 10972.06, 47545.6, 285273.6, 3138009.6,
                ],
            },
        ];
        const gameConfigs = { ...settings, odds, enableFreeBet, maxWinPerRound: crashConfig.maxWinPerRound, multiplierConfigs };
        const players = realPlayer.session?.system === Systems.Mobi ? {} : this.buildPlayersPayload(realPlayer);

        await this.getBalance(realPlayer, true);

        const user = await this.getUserInfo(realPlayer.UID);
        const recentBigWinningWinners = await this.bigWinConsumer.getRecentBigWinningWinners(realPlayer);
        return {
            gameConfigs,
            user,
            players,
            recentBigWinningWinners,
        };
    }
}
