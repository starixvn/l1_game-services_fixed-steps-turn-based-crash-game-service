import axios from "axios";

export class GameResultServiceConsumer {
    constructor({ definition, appConfigs }) {
        this.definition = definition;
        this.apiSettings = appConfigs.gameResultSettings;
    }

    async getUrl({ playerId, operatorId, siteId, roundId, mode, timeZoneOffset, language }) {
        const data = {
            internalAuth: {
                id: this.apiSettings.id,
                key: this.apiSettings.key,
            },
            auth: {
                operatorId,
            },
            gameRoundId: roundId,
            playerId,
            siteId,
            mode,
            timeZoneOffset,
            language,
            gameTypeId: this.definition.id,
        };
        const url = new URL("/BetHistory/GetAccessUrl", this.apiSettings.baseUrl);

        const response = await axios.post(url.href, data);

        return response.data;
    }
}
