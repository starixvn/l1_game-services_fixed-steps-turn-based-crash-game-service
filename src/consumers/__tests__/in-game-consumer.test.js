import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { Core, Table } from "sc-game-base";
import { Systems } from "sc-game-base/src/constants/systems";
import { RoundQuery } from "sc-game-base/src/core/query-apis";
import { BigWinConsumer, InGameConsumer, ProvablyFairConsumer } from "../../consumers";
import CrashGameData from "../../game-data";

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
        enableFreeBet: true,
        crashConfig: { maxMultiplier: 2000, maxWinPerRound: 2000 },
        odds: {},
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
        session: { currencyGroupId: "group1", currencyName: "UUS", system: 1, partnerId: 2 },
    };

    const currencyGroupGame = {
        groupId: realPlayer.session.currencyGroupId,
        minBet: 1,
        maxBet: 1000000,
    };

    gameData.currencyGroupGames = [
        {
            ...currencyGroupGame,
        },
    ];

    const provablyFairConsumer = stub(ProvablyFairConsumer);

    /** @type {BigWinConsumer}*/
    const bigWinConsumer = stub(BigWinConsumer);

    const consumer = new InGameConsumer({
        definition,
        gameData,
        roundQuery,
        publisher,
        getBalance,
        userInfosRepository,
        provablyFairConsumer,
        bigWinConsumer,
    });

    it("should be instance of Table.EventConsumers.TableInGameConsumer", () => {
        expect(consumer instanceof Table.EventConsumers.TableInGameConsumer).toBeTruthy();
    });

    describe("buildPayload tests", () => {
        beforeEach(() => {
            spyOn(Table.EventConsumers.TableInGameConsumer.prototype, "buildPlayersPayload").and.returnValue({});
            spyOn(Core.BaseEventConsumers.InGameConsumer.prototype, "getUserInfo").and.returnValue({});
            spyOn(bigWinConsumer, "getRecentBigWinningWinners").and.returnValue([]);
        });

        it("should call buildPlayersPayload", async () => {
            // act
            await consumer.buildPayload(realPlayer);

            // assert
            expect(Table.EventConsumers.TableInGameConsumer.prototype.buildPlayersPayload).toHaveBeenCalled();
        });

        it("should call getBalance", async () => {
            // act
            await consumer.buildPayload(realPlayer);

            // assert
            expect(getBalance).toHaveBeenCalled();
        });

        it("should call getUserInfo", async () => {
            // act
            await consumer.buildPayload(realPlayer);

            // assert
            expect(Table.EventConsumers.TableInGameConsumer.prototype.getUserInfo).toHaveBeenCalled();
        });

        it("should call getRecentBigWinningWinners", async () => {
            // act
            await consumer.buildPayload(realPlayer);

            // assert
            expect(bigWinConsumer.getRecentBigWinningWinners).toHaveBeenCalled();
        });

        it("should return correct result", async () => {
            // arrange
            
            const expectedResult = {
                gameConfigs: {
                    ...currencyGroupGame,
                    enableFreeBet: gameData.gameConfigs.enableFreeBet,
                    maxWinPerRound: gameData.gameConfigs.crashConfig.maxWinPerRound,
                    odds: gameData.gameConfigs.odds,
                },
                user: {},
                players: {},
                recentBigWinningWinners: [],
            };

            // act
            const actualResult = await consumer.buildPayload(realPlayer);

            // assert
            expect(actualResult).toStrictEqual(expectedResult);
        });
    });

    describe("consume tests", () => {
        const payload = {
            gameConfigs: {
                ...currencyGroupGame,
                enableFreeBet: gameData.gameConfigs.enableFreeBet,
                maxWinPerRound: gameData.gameConfigs.crashConfig.maxWinPerRound,
                odds: gameData.gameConfigs.odds,
            },
            user: {},
            players: {},
            recentBigWinningWinners: [],
        };

        beforeEach(() => {
            spyOn(consumer, "buildPayload").and.returnValue(payload);
            spyOn(provablyFairConsumer, "generateServerSeedAndPublishHash").and.returnValue({});
        });

        it("should call buildPayload", async () => {
            // act
            await consumer.consume(realPlayer);

            // assert
            expect(consumer.buildPayload).toHaveBeenCalledWith(realPlayer);
        });

        it("should call provablyFairConsumer", async () => {
            // act
            await consumer.consume(realPlayer);

            // assert
            expect(provablyFairConsumer.generateServerSeedAndPublishHash).toHaveBeenCalledWith(realPlayer.UID, realPlayer.profile.name);
        });

        it("should call publisher", async () => {
            // arrange
            const player = {
                id: realPlayer.UID,
                name: realPlayer.profile.name,
                red: payload.user.red,
                avatarId: payload.user.avatarId,
                type: payload.user.type,
            };
    
            // act
            await consumer.consume(realPlayer);

            // assert
            expect(publisher.publishToAllUsersExceptSystem).toHaveBeenCalledWith(Systems.Mobi, realPlayer.UID, { player });
        });

        it("should emit correct payload", async () => {
            // act
            await consumer.consume(realPlayer);

            // assert
            expect(realPlayer.socketClient.emit).toHaveBeenCalledWith(definition.name, payload);
        });
    });
});
