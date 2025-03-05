import { utils } from "sc-common";
import { Table } from "sc-game-base";

export default class HttpRouter extends Table.Routers.TableHttpRouter {
    init(app) {
        super.init(app);

        app.post(
            "/api/set-result",
            utils.authentication.useAuthenticate({
                authUrl: this.appConfigs.apiSettings.authUrl,
                audiences: this.appConfigs.authenticateSettings.audiences,
            }),
            (_req, res) => this.handleSetBoard(_req.body, res)
        );
    }

    handleSetBoard(params, res) {
        try {
            if (!params || !params.result || !params.nickName) {
                this.logService.logError("receives a result cheating call with invalid params.");
                res.send(false);

                return;
            }

            this.logService.logWarning(`receives a result cheating call for ${params?.nickName} with the board as ${params.result}.`);

            this.gameData.settlementResultFromAdmin[params.nickName] = params.result;

            res.send(true);
        } catch (error) {
            this.logService.logError(error);
            res.send(false);
        }
    }
}
