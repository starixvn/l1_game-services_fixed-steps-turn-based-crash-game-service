import { Core } from "sc-game-base";
import { SettleCashOutConsumer } from "../consumers";
import { UnsettledRoundConsumer } from "../consumers/unsettled-round-consumer";
export default class GameCron extends Core.Crons.BaseGameCron {
    /**
     * @param {Object} dependencies
     * @param {SettleCashOutConsumer} dependencies.settleCashOutConsumer
     * @param {UnsettledRoundConsumer} dependencies.unsettledRoundConsumer
     */
    constructor({
        definition,
        gameData,
        bot,
        settleGameRoundConsumer,
        gameStatusPublisher,
        runningRoundInfoPublisher,
        logService,
        gameConfigsRepository,
        roundsRepository,
        archiveStatusesRepository,
        notificationRepository,
        exchangeRatesRepository,
        currencyGroupGamesRepository,
        partnerConfigRepository,
        currencyGroupRepository,
        currencyRepository,
        roundResultConsumer,
        resultsRepository,
        promotionRepository,
        appConfigs,
        provablyFairConsumer,
        unsettledRoundConsumer,
        betsRepository,
        betLogsRepository,
        settleCashOutConsumer,
    }) {
        super({
            definition,
            gameData,
            bot,
            settleGameRoundConsumer,
            gameStatusPublisher,
            runningRoundInfoPublisher,
            logService,
            gameConfigsRepository,
            roundsRepository,
            archiveStatusesRepository,
            notificationRepository,
            exchangeRatesRepository,
            currencyGroupGamesRepository,
            partnerConfigRepository,
            currencyGroupRepository,
            currencyRepository,
            roundResultConsumer,
            resultsRepository,
            promotionRepository,
            appConfigs,
            provablyFairConsumer,
            unsettledRoundConsumer,
        });
        this.betsRepository = betsRepository;
        this.betLogsRepository = betLogsRepository;
        this.settleCashOutConsumer = settleCashOutConsumer;
        this.unsettledRoundConsumer = unsettledRoundConsumer;
    }
    async start() {
        await this.initRoundId();
        await this.getSettingForNewRound();
        await this.updateExchangeRates();
        await this.unsettledRoundConsumer.proceed();
        this.startCron();
    }

    async initRoundId() {
        const lastRound = await this.roundsRepository
            .findOne({}, "id", { sort: { id: -1 } })
            .lean()
            .exec();

        if (lastRound) {
            this.gameData.roundId = lastRound.id + 1000;
        } else {
            this.gameData.roundId = (await this.getLastArchiveRound()) + 1000;
        }
    }

    async proceed() {
        const { durations } = this.definition;

        if (this.gameData.remainingTime === durations.wholeRound) {
            this.bot && (await this.bot.reset());
            await this.checkGameStatus();
        }

        if (!this.gameData.disabled) {
            this.gameData.remainingTime--;
            this.bot && (await this.bot.run());
        }

        if (this.gameData.remainingTime < 0) {
            this.gameData.remainingTime = durations.wholeRound;
        }
    }
}
