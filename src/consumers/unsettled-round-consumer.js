import { UnsettledRoundConsumer as BaseUnsettledRoundConsumer } from "sc-game-base/src/core/event-consumers";
import { Actions } from "../constants";

export class UnsettledRoundConsumer extends BaseUnsettledRoundConsumer {
    async proceedUnsettledBets(unsettledBets) {
        if (unsettledBets.length > 0) {
            const betLogs = await this.betLogsRepository.find({ roundId: this.gameData.roundId }).lean().exec();
            const newBetLogs = [];

            for (const bet of unsettledBets.filter((x) => x.playerId)) {
                const betLog = betLogs.filter((x) => x.playerId === bet.playerId);

                if (!betLog.some((x) => x.action === Actions.CashOut)) {
                    const halfCashOutLog = betLog.find((x) => x.action === Actions.HalfCashOut);
                    const amount = halfCashOutLog ? halfCashOutLog.amount : bet.amount;
                    newBetLogs.push({
                        uid: bet.uid,
                        name: bet.name,
                        time: new Date(),
                        action: Actions.Refund,
                        amount: amount,
                        winAmount: amount,
                        clientSendTime: new Date(),
                        receivedTime: new Date(),
                        roundId: bet.roundId,
                        siteId: bet.siteId,
                        currency: bet.currency,
                        rate: bet.rate,
                        operatorId: bet.operatorId,
                        playerId: bet.playerId,
                    });
                }
            }

            await this.betLogsRepository.insertMany(newBetLogs);
        }
    }
}
