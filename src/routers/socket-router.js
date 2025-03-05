import { Routers } from "sc-game-base/src/core";

export default class SocketRouter extends Routers.BaseSocketRouter {
    constructor({
        definition,
        gameData,
        userSignInConsumer,
        inGameConsumer,
        placeBetConsumer,
        userDisconnectConsumer,
        userSignInPublisher,
        historyQuery,
        logService,
        playGamePermissionValidator,
        cashOutConsumer,
        roundQuery,
        gameResultServiceConsumer,
    }) {
        super({
            definition,
            gameData,
            userSignInConsumer,
            inGameConsumer,
            placeBetConsumer,
            userDisconnectConsumer,
            userSignInPublisher,
            historyQuery,
            logService,
            playGamePermissionValidator,
            roundQuery,
        });

        this.cashOutConsumer = cashOutConsumer;
        this.gameResultServiceConsumer = gameResultServiceConsumer;
    }

    init(socketClient) {
        super.init(socketClient);

        this.socketClient.on("cashOut", this.handleCashOut.bind(this));
        this.socketClient.on("betDetails", this.handleBetDetails.bind(this));
        this.socketClient.on("getProvablyFair", this.getProvablyFair.bind(this));
    }

    handleCashOut(payload) {
        try {
            if (!this.verify()) {
                return;
            }

            this.cashOutConsumer.consume(this.gameData.realPlayers[this.socketClient.id], payload);
        } catch (error) {
            this.logService.logError(error);
        }
    }

    async handleBetDetails(payload) {
        try {
            if (!this.verify()) {
                return;
            }

            const { playerId, operatorId, siteId } = this.gameData.realPlayers[this.socketClient.id].session;
            const { mode, timeZoneOffset, roundId, language } = payload;

            const result = await this.gameResultServiceConsumer.getUrl({
                playerId,
                operatorId,
                siteId,
                roundId,
                mode,
                timeZoneOffset,
                language,
            });

            if (result.isAuthenticated) {
                this.socketClient.emit(this.definition.name, { betDetailsUrl: result.redirectUrl });
            }
        } catch (error) {
            this.logService.logError(error);
        }
    }

    async getProvablyFair(payload) {
        try {
            if (!this.verify()) {
                return;
            }

            const provablyFair = await this.historyQuery.queryProvablyFair(
                this.gameData.realPlayers[this.socketClient.id],
                payload.roundId
            );

            this.socketClient.emit(this.definition.name, provablyFair);
        } catch (error) {
            this.logService.logError(error);
        }
    }
}
