import { SettleCashOutConsumer } from "./settle-cash-out-consumer";
export class UnsettledRoundConsumer {
    /**
     * @param {Object} dependencies
     * @param {GameData} dependencies.gameData
     * @param {mongoose.Model} dependencies.roundsRepository
     * @param {mongoose.Model} dependencies.betLogsRepository
     * @param {SettleCashOutConsumer} dependencies.settleCashOutConsumer
     */
    constructor({ gameData, roundsRepository, betLogsRepository, settleCashOutConsumer }) {
        this.gameData = gameData;
        this.roundsRepository = roundsRepository;
        this.betLogsRepository = betLogsRepository;

        this.settleCashOutConsumer = settleCashOutConsumer;
    }

    async proceed() {
        const unsettledBets = await this.roundsRepository.find({ paid: false }).lean().exec();

        await Promise.all(
            Object.values(unsettledBets).map(async (round) => {
                const betLogs = await this.betLogsRepository
                    .find({ roundId: round.id }, { _id: false }, { sort: { time: -1 } })
                    .lean()
                    .exec();

                const isBetLogNotExisted = !betLogs || betLogs.length === 0;
                if (isBetLogNotExisted) {
                    return;
                }

                const { siteId, currency, operatorId, playerId, rate, currencyMultiplier, currencyCode, multiplier } = betLogs[0];
                const tapCount = betLogs.length;

                const player = {
                    UID: round.uid,
                    profile: {
                        name: round.name,
                    },
                    session: {
                        siteId,
                        currencyName: currency,
                        currencyCode: currencyCode,
                        multiplier: currencyMultiplier,
                        operatorId,
                        playerId,
                        rate,
                    },
                };

                this.gameData.ingame[player.profile.name] = {
                    activeBet: {
                        roundId: round.id,
                        tapCount: tapCount,
                        currentMultiplier: multiplier,
                        amount: round.amount,
                        multiplierMode: round.multiplierMode,
                    },
                };

                await this.settleCashOutConsumer.proceedCashOut(player, true);
            })
        );
    }
}
