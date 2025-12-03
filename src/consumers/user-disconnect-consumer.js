import { Table } from "sc-game-base";
import { SettleCashOutConsumer } from "./settle-cash-out-consumer";

export class UserDisconnectConsumer extends Table.EventConsumers.TableOutGameConsumer {
    /**
     * @param {Object} dependencies
     * @param {GameData} dependencies.gameData
     * @param {BaseEventPublisher} dependencies.publisher
     * @param {mongoose.Model} dependencies.betLogsRepository
     * @param {SettleCashOutConsumer} dependencies.settleCashOutConsumer
     */
    constructor({ gameData, publisher, betLogsRepository, settleCashOutConsumer }) {
        super(gameData, publisher);
        this.settleCashOutConsumer = settleCashOutConsumer;
        this.betLogsRepository = betLogsRepository;
    }

    async consume(socketClient) {
        const player = this.gameData.realPlayers[socketClient.id];
        if (!player) {
            return;
        }

        const isValidCashOut = this.settleCashOutConsumer.validateCashOut(player);

        if (isValidCashOut) {
            await this.settleCashOutConsumer.proceedCashOut({ player, isAutoCashOut: true });
        }

        delete this.gameData.provablyFair[player.profile.name];
        delete this.gameData.ingame[player.profile.name];

        super.consume(socketClient);
    }
}
