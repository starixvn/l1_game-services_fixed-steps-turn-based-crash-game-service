import Chance from "chance";
import { stub } from "jest-micro-auto-stub";
import { helpers } from "sc-common";
import { Core } from "sc-game-base";
import { BaseEventPublisher } from "sc-game-base/src/core/event-publishers";
import gameSettings from "../../../src/game-settings";
import { Actions } from "../../constants";
import { PlaceBetConsumer } from "../place-bet-consumer";

const player = {
    socketId: "scoketId1",
    UID: "uid1",
    session: { currencyGroupId: "group1", currencyName: "UUS", system: 1, partnerId: 2 },
    profile: {
        name: "name1",
        maxBet: 8,
        minBet: 6,
    },
};

describe("PlaceBetConsumer", () => {
    const chance = new Chance();
    const payload = {
        amount: chance.natural(),
        freeBet: chance.bool(),
        roundId: chance.natural({ min: 1 }),
        autoCashOut: 3.4,
        action: Actions.bet,
        clientSeed: "999",
    };
    const definition = new Core.GameDefinition(gameSettings);
    const gameData = {
        gameConfigs: {
            odds: {},
            enableFreeBet: false,
            crashConfig: {
                maxMultiplier: 5000,
            },
            stageConfigs: {
                initialMultiplier: 1.0,
            },
        },
        exchangeRates: { code: {} },
        currencyGroupGames: [{ groupId: player.session.currencyGroupId, minBet: 4, maxBet: 18 }],
        players: {},
        ingame: {},
        roundId: 1,
        remainingTime: 30,
    };

    let consumer;

    beforeEach(() => {
        jest.clearAllMocks();

        // Arrange
        const publisher = stub(BaseEventPublisher);
        consumer = new PlaceBetConsumer(definition, gameData, publisher);
    });

    it("inherit Core.BaseEventConsumers.PlaceBetConsumer", () => {
        // Assert
        expect(consumer instanceof Core.BaseEventConsumers.PlaceBetConsumer);
    });

    describe("composeValidationCriteria", () => {
        it("should return combined results of betting time and bet amount validations", () => {
            // Arrange
            spyOn(consumer, "composeBettingTimeValidationCriteria").and.returnValue([{ id: 1 }]);
            spyOn(consumer, "composeBetAmountValidationCriteria").and.returnValue([{ id: 2 }]);
            const expectedValue = [{ id: 1 }, { id: 2 }];

            // Act
            const actualValue = consumer.composeValidationCriteria();

            // Assert
            expect(actualValue).toStrictEqual(expectedValue);
        });
    });

    describe("composeBetAmountValidationCriteria", () => {
        describe("when freeBet is true but not enabled", () => {
            it("should return failure with invalid bet", () => {
                // Arrange
                const amount = 7;
                const expectedValue = { failure: true, notice: { errorCode: helpers.noticeHelper.invalidBet } };

                // Act
                const actualValue = consumer.composeBetAmountValidationCriteria(player, amount, true);

                // Assert
                expect(actualValue[0]).toStrictEqual(expectedValue);
            });
        });

        describe("when amount < min bet", () => {
            it("should return failure with min bet", () => {
                // Arrange
                const amount = 3;
                const expectedValue = { failure: true, notice: { errorCode: helpers.noticeHelper.minBet, minBet: 6 } };

                // Act
                const actualValue = consumer.composeBetAmountValidationCriteria(player, amount, false);

                // Assert
                expect(actualValue[1]).toStrictEqual(expectedValue);
            });
        });

        describe("when amount > max bet", () => {
            it("should return failure with max bet", () => {
                // Arrange
                const amount = 19;
                const expectedValue = { failure: true, notice: { errorCode: helpers.noticeHelper.maxBet, maxBet: 8 } };

                // Act
                const actualValue = consumer.composeBetAmountValidationCriteria(player, amount, false);

                // Assert
                expect(actualValue[2]).toStrictEqual(expectedValue);
            });
        });
    });

    describe("validateBetRequest", () => {
        describe("when have failure", () => {
            it("should return false", () => {
                // Arrange
                consumer.gameData = { currencyGroupGames: [{ groupId: "group1", minBet: 4, maxBet: 18 }] };
                spyOn(consumer, "composeValidationCriteria").and.returnValue([{ failure: true, notice: { code: 1 } }]);
                const amount = 3;

                // Act
                const actualValue = consumer.validateBetRequest(player, amount, false, 1);

                // Assert
                expect(actualValue).toBeFalsy();
            });
        });

        describe("when not have failure", () => {
            it("should return true", () => {
                // Arrange
                consumer.gameData = { currencyGroupGames: [{ groupId: player.session.currencyGroupId, minBet: 4, maxBet: 18 }] };
                spyOn(consumer, "composeValidationCriteria").and.returnValue([{ failure: false, notice: { code: 1 } }]);
                const amount = 3;
                const autoCashOut = 2;
                // Act
                const actualValue = consumer.validateBetRequest(player, amount, false, 2, autoCashOut);

                // Assert
                expect(actualValue).toBeTruthy();
            });
        });
    });

    describe("consume", () => {
        beforeEach(() => {
            consumer.validateRequestParams = jest.fn().mockReturnValue(true);
            consumer.validateBetRequest = jest.fn().mockReturnValue(true);
            consumer.adjustBetTracks = jest.fn();
            gameData.ingame = {};
        });

        it("should call validateRequestParams", () => {
            // Act
            consumer.consume(player, payload);

            // Assert
            expect(consumer.validateRequestParams).toBeCalledWith(payload, player);
        });

        describe("when bet request is invalid", () => {
            beforeEach(() => {
                consumer.validateBetRequest.mockReturnValue(false);
            });

            it("should NOT call adjustBetTracks", () => {
                // Act
                consumer.consume(player, payload);

                // Assert
                expect(consumer.adjustBetTracks).not.toBeCalled();
            });

            it("should NOT push bet to bet queue", () => {
                // Act
                consumer.consume(player, payload);

                // Assert
                expect(gameData.ingame[player.profile.name]?.betQueue?.length ?? 0).toBe(0);
            });
        });

        describe("when requestParams is valid", () => {
            beforeEach(() => {
                consumer.validateRequestParams.mockReturnValue(true);
            });

            it("should call validateBetRequest", () => {
                // Act
                consumer.consume(player, payload);

                // Assert
                expect(consumer.validateBetRequest).toBeCalledWith(player, payload.amount, payload.freeBet, payload.roundId);
            });

            it("should call adjustBetTracks", () => {
                // Act
                consumer.consume(player, payload);

                // Assert
                expect(consumer.adjustBetTracks).toBeCalledWith(player.profile.name, payload);
            });

            it("should push bet to bet queue", () => {
                // Act
                consumer.consume(player, payload);

                // Assert
                expect(gameData.ingame[player.profile.name].betQueue.length).toBe(1);
                expect(gameData.ingame[player.profile.name].betQueue[0]).toEqual({
                    player,
                    payload,
                });
            });

            describe("when player info is NOT exist on ingame data", () => {
                it("should add player info to ingame data", () => {
                    // Arrange
                    gameData.ingame = {};

                    // Act
                    consumer.consume(player, payload);

                    // Assert
                    expect(gameData.ingame[player.profile.name]).toBeDefined();
                    expect(gameData.ingame[player.profile.name]).toMatchObject({
                        name: player.profile.name,
                        currency: player.session.currencyName,
                        system: player.session.system,
                        betTracks: {},
                        betQueue: expect.any(Array),
                        operatorId: player.session.operatorId,
                        playerData: expect.objectContaining(player),
                        currentMultiplier: expect.any(Number),
                    });
                });
            });
        });
    });

    describe("adjustBetTrack", () => {
        describe("when having player info on ingame data", () => {
            it("should update player betTracks", () => {
                // Arrange
                gameData.ingame[player.profile.name] = { betTracks: {} };

                // Act
                consumer.adjustBetTracks(player.profile.name, payload);

                // Assert
                expect(gameData.ingame[player.profile.name].betTracks[payload.action].amount).toStrictEqual(payload.amount);
            });
        });
    });
});
