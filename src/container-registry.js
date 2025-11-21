import awilix from "awilix";
import { Table } from "sc-game-base";
import {
    CashOutConsumer,
    InGameConsumer,
    MineConsumer,
    PlaceBetConsumer,
    ProvablyFairConsumer,
    RecentBetConsumer,
    SettleCashOutConsumer,
    SettleGameRoundConsumer,
    UnsettledRoundConsumer,
    UserDisconnectConsumer,
} from "./consumers";
import { GameCrons, Bot, ProcessBetQueue } from "./crons";
import { PlaceBetPublisher, RecentBetPublisher, RoundResultPublisher, UserBetResultPublisher } from "./event-publishers";
import { BetLogs, RecentBets, Results, Rounds, umInfo } from "./models";
import { HistoryQuery } from "./query-apis";
import { HttpRouter, SocketRouter } from "./routers";
import UmInfoWatcher from "./watchers/um-info-watcher";

const { asClass, asValue } = awilix;

export default class ContainerRegistry extends Table.TableContainerRegistry {
    register(appConfigs, definition, gameData) {
        super.register(appConfigs, definition, gameData);
        this.registerWatchers();
        this.registerPFSettings();

        return this.container;
    }

    registerWatchers() {
        this.container.register({
            umInfoWatcher: asClass(UmInfoWatcher).singleton(),
        });
    }

    registerModels() {
        const definition = this.container.resolve("definition");
        super.registerModels();

        this.container.register({
            roundsRepository: asValue(Rounds(definition.configName)),
            resultsRepository: asValue(Results(definition.configName)),
            betLogsRepository: asValue(BetLogs(definition.configName)),
            recentBetsRepository: asValue(RecentBets(definition.configName)),
            umInfoRepository: asValue(umInfo()),
        });
    }

    registerConsumers() {
        super.registerConsumers();

        this.container.register({
            mineConsumer: asClass(MineConsumer).singleton(),
            inGameConsumer: asClass(InGameConsumer).singleton().proxy(),
            placeBetConsumer: asClass(PlaceBetConsumer).singleton(),
            cashOutConsumer: asClass(CashOutConsumer).singleton(),
            settleGameRoundConsumer: asClass(SettleGameRoundConsumer).singleton().proxy(),
            settleCashOutConsumer: asClass(SettleCashOutConsumer).singleton().proxy(),
            unsettledRoundConsumer: asClass(UnsettledRoundConsumer).singleton().proxy(),
            provablyFairConsumer: asClass(ProvablyFairConsumer).singleton(),
            userDisconnectConsumer: asClass(UserDisconnectConsumer).singleton().proxy(),
            recentBetConsumer: asClass(RecentBetConsumer).singleton(),
        });
    }

    registerPublishers() {
        super.registerPublishers();

        this.container.register({
            placeBetPublisher: asClass(PlaceBetPublisher).singleton(),
            userBetResultPublisher: asClass(UserBetResultPublisher).singleton(),
            roundResultPublisher: asClass(RoundResultPublisher).singleton(),
            recentBetPublisher: asClass(RecentBetPublisher).singleton(),
        });
    }

    registerCrons() {
        super.registerCrons();

        this.container.register({
            gameCron: asClass(GameCrons).singleton().proxy(),
            processBetQueue: asClass(ProcessBetQueue).singleton().proxy(),
            bot: asClass(Bot).singleton(),
        });
    }

    registerRouters() {
        super.registerRouters();

        this.container.register({
            socketRouter: asClass(SocketRouter).proxy(),
            httpRouter: asClass(HttpRouter),
        });
    }

    registerApis() {
        super.registerApis();

        this.container.register({
            historyQuery: asClass(HistoryQuery).singleton(),
        });
    }
}
