import { Core } from "sc-game-base";
import { BaseEventPublisher } from "sc-game-base/src/core/event-publishers";
import { CashOutConsumer } from "../cash-out-consumer";
import gameSettings from "../../../src/game-settings";
import Chance from "chance";
import { stub } from "jest-micro-auto-stub";
import noticeHelper from "../../helpers/notice-helper";
import { Actions } from "../../constants";

describe("CashOutConsumer", () => {
    let consumer;
    let publisher;
    let gameData;
    let player;
    const chance = new Chance();

    const createTestPlayer = (overrides = {}) => ({
        socketId: chance.guid(),
        UID: chance.guid(),
        session: {
            currencyGroupId: "group1",
            currencyName: "USD",
            system: 1,
            partnerId: 2,
            ...overrides.session,
        },
        profile: {
            name: chance.name(),
            maxBet: 8,
            minBet: 6,
            ...overrides.profile,
        },
        ...overrides,
    });

    const createTestGameData = (player, overrides = {}) => ({
        gameConfigs: {
            odds: {},
            enableFreeBet: false,
            enabled: true,
            ...overrides.gameConfigs,
        },
        exchangeRates: { code: {} },
        currencyGroupGames: [
            {
                groupId: player.session.currencyGroupId,
                minBet: 4,
                maxBet: 18,
                ...overrides.currencyGroupGames,
            },
        ],
        players: {},
        ingame: {},
        roundId: chance.natural(),
        remainingTime: -1,
        ...overrides,
    });

    beforeEach(() => {
        player = createTestPlayer();
        gameData = createTestGameData(player);

        gameData.ingame[player.profile.name] = {
            betQueue: [],
            betTracks: {
                [Actions.Bet]: { time: new Date() },
                [Actions.CashOut]: { time: undefined },
            },
        };

        publisher = stub(BaseEventPublisher);
        const definition = new Core.GameDefinition(gameSettings);
        consumer = new CashOutConsumer(definition, gameData, publisher);

        jest.clearAllMocks();
    });

    describe("consume", () => {
        let payload;

        beforeEach(() => {
            // Arrange
            payload = {
                roundId: gameData.roundId,
                multiplier: chance.floating({ min: 1, max: 10 }),
                clientSendTime: new Date(),
                mode: chance.pickone(["landscape", "portrait"]),
            };
            consumer.validateRequest = jest.fn().mockReturnValue(true);
            consumer.adjustBetTracks = jest.fn();
        });

        it("should enrich payload with required fields", () => {
            // Act
            consumer.consume(player, payload);

            // Assert
            expect(payload).toMatchObject({
                roundId: gameData.roundId,
                m: payload.multiplier,
                clientSendTime: expect.any(Date),
                mode: expect.any(String),
                receivedTime: expect.any(Date),
                action: Actions.CashOut,
            });
        });

        it("should validate the request with correct parameters", () => {
            // Act
            consumer.consume(player, payload);

            // Assert
            expect(consumer.validateRequest).toHaveBeenCalledWith(player, payload.roundId, payload.clientSendTime, payload.receivedTime);
        });

        describe("when validation fails", () => {
            beforeEach(() => {
                // Arrange
                consumer.validateRequest.mockReturnValue(false);
            });

            it("should not adjust bet tracks", () => {
                // Act
                consumer.consume(player, payload);

                // Assert
                expect(consumer.adjustBetTracks).not.toHaveBeenCalled();
            });

            it("should not add to bet queue", () => {
                // Act
                consumer.consume(player, payload);

                // Assert
                expect(gameData.ingame[player.profile.name].betQueue).toHaveLength(0);
            });
        });

        describe("when validation succeeds", () => {
            it("should adjust bet tracks with correct parameters", () => {
                // Act
                consumer.consume(player, payload);

                // Assert
                expect(consumer.adjustBetTracks).toHaveBeenCalledWith(player.profile.name, payload);
            });

            it("should add to bet queue", () => {
                // Act
                consumer.consume(player, payload);

                // Assert
                expect(gameData.ingame[player.profile.name].betQueue).toHaveLength(1);
                expect(gameData.ingame[player.profile.name].betQueue[0]).toEqual({
                    player,
                    payload,
                });
            });
        });
    });

    describe("validateRequest", () => {
        let clientSendTime;
        let receivedTime;

        beforeEach(() => {
            // Arrange
            clientSendTime = new Date();
            receivedTime = new Date(clientSendTime.getTime() + 100); // 100ms later
        });

        it("should validate game enabled status", () => {
            // Arrange
            gameData.gameConfigs.enabled = false;

            // Act
            const result = consumer.validateRequest(player, gameData.roundId, clientSendTime, receivedTime);

            // Assert
            expect(result).toBeFalsy();
            expect(publisher.publishToUser).toHaveBeenCalledWith(
                player.UID,
                expect.objectContaining({
                    endBet: -1,
                    notice: expect.objectContaining({
                        errorCode: noticeHelper.invalidCashOut,
                    }),
                })
            );
        });

        it("should fail validation if player has no bet", () => {
            // Arrange
            gameData.ingame[player.profile.name].betTracks[Actions.Bet].time = undefined;

            // Act
            const result = consumer.validateRequest(player, gameData.roundId, clientSendTime, receivedTime);

            // Assert
            expect(result).toBeFalsy();
            expect(publisher.publishToUser).toHaveBeenCalledWith(
                player.UID,
                expect.objectContaining({
                    endBet: -1,
                    notice: expect.objectContaining({
                        errorCode: noticeHelper.invalidCashOut,
                    }),
                })
            );
        });

        it("should fail validation if player has already cashed out", () => {
            // Arrange
            gameData.ingame[player.profile.name].betTracks[Actions.CashOut].time = new Date();

            // Act
            const result = consumer.validateRequest(player, gameData.roundId, clientSendTime, receivedTime);

            // Assert
            expect(result).toBeFalsy();
            expect(publisher.publishToUser).toHaveBeenCalledWith(
                player.UID,
                expect.objectContaining({
                    endBet: -1,
                    notice: expect.objectContaining({
                        errorCode: noticeHelper.invalidCashOut,
                    }),
                })
            );
        });

        it("should pass validation if all criteria are met", () => {
            // Act
            const result = consumer.validateRequest(player, gameData.roundId, clientSendTime, receivedTime);

            // Assert
            expect(result).toBeTruthy();
        });
    });

    describe("adjustBetTracks", () => {
        it("should update bet tracks with received time", () => {
            // Arrange
            const playerName = player.profile.name;
            const bet = {
                receivedTime: new Date(),
                action: Actions.CashOut,
            };

            // Act
            consumer.adjustBetTracks(playerName, bet);

            // Assert
            expect(gameData.ingame[playerName].betTracks[Actions.CashOut].time).toEqual(bet.receivedTime);
        });

        it("should not throw if player is not in game data", () => {
            // Arrange
            const playerName = "nonExistentPlayer";
            const bet = {
                receivedTime: new Date(),
                action: Actions.CashOut,
            };

            // Act & Assert
            expect(() => consumer.adjustBetTracks(playerName, bet)).not.toThrow();
        });
    });

    describe("isNotHavingBet", () => {
        it("should return true when bet tracks is undefined", () => {
            expect(consumer.isNotHavingBet(undefined)).toBeTruthy();
        });

        it("should return true when bet time is undefined", () => {
            const betTracks = {
                [Actions.Bet]: { time: undefined },
            };
            expect(consumer.isNotHavingBet(betTracks)).toBeTruthy();
        });

        it("should return false when bet time exists", () => {
            const betTracks = {
                [Actions.Bet]: { time: new Date() },
            };
            expect(consumer.isNotHavingBet(betTracks)).toBeFalsy();
        });
    });

    describe("isAlreadyCashout", () => {
        it("should return false when bet tracks is undefined", () => {
            expect(consumer.isAlreadyCashout(undefined)).toBeFalsy();
        });

        it("should return false when cashout time is undefined", () => {
            const betTracks = {
                [Actions.CashOut]: { time: undefined },
            };
            expect(consumer.isAlreadyCashout(betTracks)).toBeFalsy();
        });

        it("should return true when cashout time exists", () => {
            const betTracks = {
                [Actions.CashOut]: { time: new Date() },
            };
            expect(consumer.isAlreadyCashout(betTracks)).toBeTruthy();
        });
    });
});
