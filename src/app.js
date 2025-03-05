import appConfigs from "./app-configs";
import { addIdentifiers, initSpanProcessor, initializer } from "sc-instrument";

import { Core, Table } from "sc-game-base";
import ContainerRegistry from "./container-registry";
import CrashGameData from "./game-data";
import gameSettings from "./game-settings";
import { logger } from "sc-common";
import { gameConfigs as gameConfigsRepository } from "sc-base-database";
import { generateRawResultForHash, generateResult, getSettlementResult } from "./helpers/result-helper";

const run = async () => {
    const appName = process.env.APP_NAME;
    const gameName = appName ? appName.replace("service", "").replaceAll("_", "").trimEnd() : "";

    if (appConfigs.otel?.enabled) {
        const { otel } = appConfigs;
        initSpanProcessor(otel.endpoint, initializer);
        addIdentifiers(`${otel.system} - ${appName}`, appConfigs.sentry.env, initializer);
        initializer.start();
    }

    if (appName) {
        appConfigs.database.url = appConfigs.database.url.concat(`&appName=${gameName.toLowerCase()}`);
        appConfigs.sentry.logIdentifier = gameName.toLowerCase();

        const app = new Core.BaseGameApp(gameName, appConfigs);
        await app.run();

        const gameConfigs = await gameConfigsRepository.findOne({ name: gameName.toLowerCase() }).lean().exec();

        if (gameConfigs) {
            gameSettings.id = gameConfigs.gameId;
            gameSettings.name = gameConfigs.name;

            const definition = new Table.TableGameDefinition(gameSettings, generateResult, getSettlementResult, generateRawResultForHash);
            const gameData = new CrashGameData(gameSettings.durations.wholeRound);
            const container = new ContainerRegistry().register(appConfigs, definition, gameData);

            await app.startGame(container);
        } else {
            logger.logCritical(`${gameName} config doesn't exist`);
        }
    } else {
        console.log("App Name is not defined, failed to boostrap the service");
    }
};

process.on("exit", async (code) => {
    console.log(`About to exit with code: ${code}`);
    await initializer.shutdown();
});

run();
