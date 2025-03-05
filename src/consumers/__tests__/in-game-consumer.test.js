import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { Core, Table } from "sc-game-base";
import { RoundQuery } from "sc-game-base/src/core/query-apis";
import CrashGameData from "../../game-data";
import { InGameConsumer } from "../in-game-consumer";

describe("in game consumer instance", () => {
    const definition = {
        id: 41,
        name: "crash",
        durations: {
            wholeRound: 14,
            placingBets: 10,
            lockingBet: 3,
            liveTime: 0,
        },
    };
    const gameData = new CrashGameData(0);
    gameData.gameConfigs = {
        crashConfig: { maxMultiplier: 2000, maxWinPerRound: 2000 },
    };

    /** @type {mongoose.Model}*/
    const userInfosRepository = stubMongoose(mongoose.Model);
    const roundQuery = stub(RoundQuery);
    const publisher = stub(Core.BaseEventPublishers.BaseEventPublisher);
    const getBalance = jest.fn();
    const realPlayer = {
        UID: "123",
        socketClient: {
            emit: jest.fn(),
        },
        profile: {
            name: "player01",
        },
    };

    const consumer = new InGameConsumer(definition, gameData, roundQuery, publisher, getBalance, userInfosRepository);

    it("should be instance of Table.EventConsumers.TableInGameConsumer", () => {
        expect(consumer instanceof Table.EventConsumers.TableInGameConsumer).toBeTruthy();
    });

    describe("buildPayload tests", () => {
        const basePayload = {
            roundId: 1,
            gameConfigs: {},
            roundHistory: [],
            totalBets: {},
            user: {},
        };
        beforeEach(() => {
            spyOn(Table.EventConsumers.TableInGameConsumer.prototype, "buildPayload").and.callFake(() => basePayload);
        });

        it("should call super.buildPayload", async () => {
            // act
            await consumer.buildPayload(realPlayer);

            // assert
            expect(Table.EventConsumers.TableInGameConsumer.prototype.buildPayload).toHaveBeenCalled();
        });

        it("should return correct result when remaining time greater than finish first half", async () => {
            // arrange
            gameData.remainingTime = definition.durations.lockingBet;
            const expectedResult = {
                ...basePayload,
                ownBets: undefined,
                betList: {},
            };

            // act
            const actualResult = await consumer.buildPayload(realPlayer);

            // assert
            expect(actualResult).toStrictEqual(expectedResult);
        });
    });
});
