import { EventConsumers } from "sc-game-base/src/table";
import { Actions } from "../constants";
import { decrypt } from "../helpers/crypto-helper";
import { ProvablyFairConsumer } from "./provably-fair-consumer";
export class SettleGameRoundConsumer extends EventConsumers.TableSettleGameRoundConsumer {
    /**
     * @param {Object} dependencies
     * @param {ProvablyFairConsumer} dependencies.provablyFairConsumer
     */
    constructor({
        definition,
        gameData,
        roundResultPublisher,
        userBetResultPublisher,
        endGame,
        roundsRepository,
        betsRepository,
        betLogsRepository,
        logService,
        provablyFairConsumer,
        resultsRepository,
    }) {
        super({
            definition,
            gameData,
            roundResultPublisher,
            userBetResultPublisher,
            endGame,
            roundsRepository,
            betsRepository,
        });

        this.betLogsRepository = betLogsRepository;
        this.logService = logService;
        this.provablyFairConsumer = provablyFairConsumer;
        this.resultsRepository = resultsRepository;
    }

    queryRound(roundId) {
        return this.roundsRepository.findOne({ id: roundId }).exec();
    }

    async queryBetLogs(roundId) {
        return this.betLogsRepository.find({ roundId }).lean().exec();
    }

    async settleRound({ roundId, time, player, playerName, isUserDisconnect = false }) {
        try {
            const round = await this.queryRound(roundId);
            const result = await this.resultsRepository.findOne({ roundId }).lean().exec();
            const crashPoint = decrypt(result?.encryptedFinalResult);
            const betLogs = await this.queryBetLogs(roundId);
            const cashOutLog = betLogs.find((log) => log.action === Actions.CashOut);

            if (!round || !cashOutLog || !result) {
                this.logService.logError(`${this.definition.name} Settle Error: Invalid round data: ${roundId}`);
                return 0;
            }

            const winAmount = Math.min(round.amount * this.getMultiplier(cashOutLog), round.maxWin);

            const betResult = this.calculateBetResult(round.amount, winAmount);

            round.betWin = betResult.totalWin;
            round.betwin = betResult.totalWin;
            round.result = +crashPoint;
            round.paid = true;
            round.tapCount = betLogs.length - 1;
            round.multiplier = this.getMultiplier(cashOutLog);
            round.reachMaxWin = winAmount === round.maxWin;

            await this.callEndGame(round, round.id, time, betResult);
            await round.save();

            if (player) {
                if (!isUserDisconnect) {
                    await this.userBetResultPublisher.publish(player.UID, {
                        ...betResult,
                        rate: cashOutLog.rate,
                        reachMaxWin: round.reachMaxWin,
                    });
                }
                this.updatePlayerBetTracks(round.name);
                this.gameData.ingame[playerName].betTracks = {};

                delete this.gameData.provablyFair[playerName];
                delete this.gameData.ingame[playerName]?.activeBet;

                this.provablyFairConsumer.generateServerSeedAndPublishHash(player.UID, player.profile.name);
            }

            return winAmount;
        } catch (error) {
            this.logService?.logError(`Failed to settle round ${roundId}: ${error}`);
            throw error;
        }
    }

    updatePlayerBetTracks(playerName) {
        const playerGameData = this.gameData.ingame[playerName];

        if (playerGameData) {
            playerGameData.betTracks = {};
            playerGameData.activeBet = null;
        }
    }

    getMultiplier(cashOutLog) {
        if (!cashOutLog) {
            return 0;
        }

        return cashOutLog.multiplier;
    }

    calculateBetResult(betAmount, winAmount) {
        const winLoss = winAmount - betAmount;

        return {
            totalBetAmount: +betAmount.toFixed(2),
            totalWin: +winAmount.toFixed(2),
            netWin: +(winLoss > 0 ? winLoss : 0).toFixed(2),
            totalLost: +(winLoss < 0 ? -winLoss : 0).toFixed(2),
        };
    }
}
