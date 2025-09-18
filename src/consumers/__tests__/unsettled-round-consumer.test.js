import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { ProvablyFairConsumer, RoundResultConsumer } from "sc-game-base/src/core/event-consumers";
import { TableGameDefinition } from "sc-game-base/src/table";
import { Actions } from "../../constants";
import CrashGameData from "../../game-data";
import gameSettings from "../../game-settings";
import { SettleGameRoundConsumer } from "../settle-game-round-consumer";
import { UnsettledRoundConsumer } from "../unsettled-round-consumer";

const definition = new TableGameDefinition(gameSettings, jest.fn());
let gameData;

/** @type {mongoose.Model}*/
const betsRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const tempBetsRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const betLogsRepository = stubMongoose(mongoose.Model);
const settleGameRoundConsumer = stub(SettleGameRoundConsumer);
const roundResultConsumer = stub(RoundResultConsumer);
const provablyFairConsumer = stub(ProvablyFairConsumer);

beforeEach(() => {
    gameData = new CrashGameData(3);
});

afterEach(() => {
    jest.clearAllMocks();
});

function initConsumer() {
    return new UnsettledRoundConsumer({
        gameData,
        definition,
        betsRepository,
        betLogsRepository,
        tempBetsRepository,
        settleGameRoundConsumer,
        roundResultConsumer,
        provablyFairConsumer,
    });
}

describe.skip("unsettledRoundConsumer", () => {
    describe("proceedUnsettledBets", () => {
        describe("when there are no unsettled bets", () => {
            it("shouldn't call betLogsRepository.insertMany", async () => {
                // Arrange
                const unsettledRoundConsumer = initConsumer();

                // Act
                await unsettledRoundConsumer.proceedUnsettledBets([]);

                // Assert
                expect(betLogsRepository.insertMany).not.toHaveBeenCalled();
            });
        });

        describe("when there are unsettled bets", () => {
            beforeAll(() => {
                jest.useFakeTimers("modern");
                jest.setSystemTime(new Date(2024, 3, 1));
            });

            afterAll(() => {
                jest.useRealTimers();
            });

            const unsettledBets = [
                {
                    uid: "player1-uid",
                    name: "player1",
                    clientSeed: "seed1",
                    time: new Date(),
                    amount: 10,
                    roundId: 1,
                    siteId: "123",
                    currency: "USD",
                    rate: 1,
                    operatorId: "OW",
                    playerId: 1,
                },
                {
                    uid: "player2-uid",
                    name: "player2",
                    clientSeed: "seed2",
                    time: new Date(new Date().getTime() + 10000),
                    amount: 10,
                    roundId: 1,
                    siteId: "123",
                    currency: "USD",
                    rate: 1,
                    operatorId: "OW",
                    playerId: 2,
                },
            ];

            it("should insert refund betlogs for player not cashing out", async () => {
                // Arrange
                const betLogs = [
                    {
                        uid: "player2-uid",
                        name: "player2",
                        playerId: 2,
                        action: Actions.CashOut,
                        amount: 10,
                        siteId: "123",
                        currency: "USD",
                        rate: 1,
                        operatorId: "OW",
                    },
                ];
                gameData.lastResultRecord = { serverSeed: "seed", finalHash: "hash" };

                betLogsRepository.find().lean().exec.mockReturnValueOnce(betLogs);
                const unsettledRoundConsumer = initConsumer();

                // Act
                await unsettledRoundConsumer.proceedUnsettledBets(unsettledBets);

                // Assert
                expect(betLogsRepository.insertMany).toHaveBeenCalledWith([
                    {
                        uid: "player1-uid",
                        name: "player1",
                        time: new Date(2024, 3, 1),
                        action: Actions.Refund,
                        amount: 10,
                        winAmount: 10,
                        clientSendTime: new Date(2024, 3, 1),
                        receivedTime: new Date(2024, 3, 1),
                        roundId: 1,
                        siteId: "123",
                        currency: "USD",
                        rate: 1,
                        operatorId: "OW",
                        playerId: 1,
                    },
                ]);
            });

            it("should insert refund betlogs for player half cash out", async () => {
                // Arrange
                const betLogs = [
                    {
                        uid: "player1-uid",
                        name: "player1",
                        playerId: 1,
                        action: Actions.HalfCashOut,
                        amount: 5,
                        siteId: "123",
                        currency: "USD",
                        rate: 1,
                        operatorId: "OW",
                    },
                    {
                        uid: "player2-uid",
                        name: "player2",
                        playerId: 2,
                        action: Actions.CashOut,
                        amount: 10,
                        siteId: "123",
                        currency: "USD",
                        rate: 1,
                        operatorId: "OW",
                    },
                ];

                gameData.lastResultRecord = { serverSeed: "seed", finalHash: "hash" };

                betLogsRepository.find().lean().exec.mockReturnValueOnce(betLogs);
                const unsettledRoundConsumer = initConsumer();

                // Act
                await unsettledRoundConsumer.proceedUnsettledBets(unsettledBets);

                // Assert
                expect(betLogsRepository.insertMany).toHaveBeenCalledWith([
                    {
                        uid: "player1-uid",
                        name: "player1",
                        time: new Date(),
                        action: Actions.Refund,
                        amount: 5,
                        winAmount: 5,
                        clientSendTime: new Date(),
                        receivedTime: new Date(),
                        roundId: 1,
                        siteId: "123",
                        currency: "USD",
                        rate: 1,
                        operatorId: "OW",
                        playerId: 1,
                    },
                ]);
            });
        });
    });
});
