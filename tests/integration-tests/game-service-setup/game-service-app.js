import { Core, Table } from "sc-game-base";
import { initAPIStub, stubUserService } from "sc-game-service-integration-utils";
import appConfigs from "../../../src/app-configs.IGT";
import CrashGameData from "../../../src/game-data";
import gameSettings from "../../../src/game-settings";
import { generateRawResultForHash, getSettlementResult } from "../../../src/helpers/result-helper";
import IGTContainerRegistry from "./igt-container-registry";

const igtGenerateResult = () => 1.2;

export const run = async () => {
    initAPIStub(appConfigs.apiSettings.apiUrl);
    stubUserService(appConfigs);

    const definition = new Table.TableGameDefinition(gameSettings, igtGenerateResult, getSettlementResult, generateRawResultForHash);
    const gameData = new CrashGameData(gameSettings.durations.wholeRound);
    const container = new IGTContainerRegistry().register(appConfigs, definition, gameData);
    const app = new Core.BaseGameApp("Spaceflight", appConfigs);

    await app.run();
    await app.startGame(container);
};

run();
