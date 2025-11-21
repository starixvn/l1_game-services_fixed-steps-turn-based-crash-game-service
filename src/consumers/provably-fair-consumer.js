import { SeedHelper, ServerSeedHelper } from "sc-game-base/src/core/helpers";
import { encrypt } from "../helpers/crypto-helper";
import { roundFloat } from "../helpers/number-helper";

export class ProvablyFairConsumer {
    constructor(gameData, definition, roundResultPublisher, resultsRepository) {
        this.gameData = gameData;
        this.definition = definition;
        this.roundResultPublisher = roundResultPublisher;
        this.resultsRepository = resultsRepository;

        this.gameData.provablyFair = {};
    }

    generateServerSeedAndPublishHash(playerId, playerName) {
        let provablyFair = this.gameData.provablyFair[playerName];

        if (!provablyFair) {
            const { randomMode } = this.gameData.gameConfigs;
            provablyFair = {};
            provablyFair.serverSeed = ServerSeedHelper.generateServerSeed(randomMode);
            provablyFair.serverSeedHash = SeedHelper.getSHA256Hash(provablyFair.serverSeed);

            this.gameData.provablyFair[playerName] = provablyFair;
        }

        this.roundResultPublisher.publishProvablyFair(playerId, provablyFair);
    }

    generateCrashPoint(playerName, clientSeed, roundId) {
        const provablyFair = this.gameData?.provablyFair?.[playerName] ?? {};
        provablyFair.clientSeed = this.validateClientSeed(clientSeed) ? clientSeed : 0;
        provablyFair.finalHash = SeedHelper.getSHA512Hash(provablyFair.serverSeed + clientSeed);
        provablyFair.finalResult = this.getResultFromAdmin(playerName, this.definition.generateResult(provablyFair.finalHash));
        provablyFair.roundId = roundId;

        this.gameData.provablyFair[playerName] = provablyFair;

        return provablyFair.finalResult;
    }

    getResultFromAdmin(playerName, result) {
        const resultFromAdmin = this.gameData.settlementResultFromAdmin[playerName];
        let finalResult = result;

        if (resultFromAdmin) {
            finalResult = resultFromAdmin;

            delete this.gameData.settlementResultFromAdmin[playerName];
        }

        return roundFloat(finalResult);
    }

    async createResultRecord(playerName, roundId) {
        const record = await this.findResultRecord(roundId);
        if (!record) {
            const provablyFair = this.gameData.provablyFair[playerName];

            const encryptedServerSeed = encrypt(provablyFair.serverSeed);
            const encryptedFinalResult = encrypt(`${provablyFair.finalResult}`);
            const encryptedFinalHash = encrypt(provablyFair.finalHash);

            await this.resultsRepository.create({
                roundId: roundId,
                serverSeedHash: provablyFair.serverSeedHash,
                clientSeeds: [provablyFair.clientSeed],
                mergeClientSeed: provablyFair.clientSeed,
                encryptedServerSeed,
                encryptedFinalResult,
                encryptedFinalHash,
                time: new Date(),
            });
        }
    }

    async findResultRecord(roundId) {
        return this.resultsRepository.findOne({ roundId: roundId }).lean().exec();
    }

    validateClientSeed(clientSeed) {
        return Number.isInteger(parseInt(clientSeed));
    }
}
