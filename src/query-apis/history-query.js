import { QueryApis } from "sc-game-base/src/core";
import { decrypt } from "../helpers/crypto-helper";

export default class HistoryQuery extends QueryApis.HistoryQuery {
    constructor(roundQuery, betsRepository, betLogsRepository, roundsRepository, resultsRepository) {
        super(roundQuery, betsRepository, betLogsRepository);
        this.roundsRepository = roundsRepository;
        this.resultsRepository = resultsRepository;
    }

    convertBet(bet) {
        return { ...bet, totalAmount: bet.amount };
    }

    async queryHistory(player, page, pageSize = 8) {
        if (page < 1 || !player) {
            return {};
        }

        const filter = { uid: player.UID, paid: true };
        const numberOfSkippedBets = (page - 1) * pageSize;
        const total = await this.roundsRepository.countDocuments(filter).exec();
        const betProjection = {
            _id: false,
            uid: false,
            paid: false,
            odds: false,
            siteId: false,
            playerId: false,
            __v: false,
            __archive: false,
            currency: false,
            operatorId: false,
        };
        const rounds = await this.roundsRepository
            .find(filter, betProjection, { sort: { id: -1 }, skip: numberOfSkippedBets, limit: pageSize })
            .lean()
            .exec();

        const bets = rounds.map((round) => this.convertRound(round));

        return { history: { betLogs: bets, page, pageSize, total } };
    }

    convertRound(round) {
        round.roundId = round.id;
        round.totalAmount = round.amount;
        delete round.id;
        delete round.amount;

        return round;
    }

    async queryProvablyFair(player, roundId) {
        let provablyFair = {};
        const round = await this.roundsRepository.findOne({ id: roundId, uid: player.UID, paid: true }).lean().exec();
        if (round) {
            const resultRecord = await this.resultsRepository.findOne({ roundId: roundId }).lean().exec();
            if (resultRecord) {
                provablyFair = {
                    serverSeedHash: resultRecord.serverSeedHash,
                    clientSeed: resultRecord.mergeClientSeed,
                    serverSeed: decrypt(resultRecord.encryptedServerSeed),
                    finalResult: decrypt(resultRecord.encryptedFinalResult),
                    finalHash: decrypt(resultRecord.encryptedFinalHash),
                    roundId: roundId,
                };
            }
        }

        return { provablyFair };
    }
}
