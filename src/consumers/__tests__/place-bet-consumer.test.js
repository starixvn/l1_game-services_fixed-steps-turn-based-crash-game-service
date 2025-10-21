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
    session: { currencyGroupId: "group1", currencyName: "UUS", system: 1, partnerId: 2, operatorId: "op1" },
    profile: {
        name: "name1",
        maxBet: 8,
        minBet: 6,
    },
};

describe("PlaceBetConsumer", () => {
    const chance = new Chance();
    const payload = {
        amount: 10,
        freeBet: chance.bool(),
        roundId: 1,
        autoCashOut: 3.4,
        action: Actions.Bet,
        clientSeed: "999",
        m: "1", // mode
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
            },
            enabled: true,
        },
        exchangeRates: { code: {} },
        currencyGroupGames: [{ groupId: player.session.currencyGroupId, minBet: 4, maxBet: 18 }],
        players: {},
        ingame: {},
        roundId: 1,
        remainingTime: 30,
    };

    /**
     * @type {PlaceBetConsumer}
     */
    let consumer;
    let publisher;

    beforeEach(() => {
        jest.clearAllMocks();
        publisher = stub(BaseEventPublisher);
        consumer = new PlaceBetConsumer(definition, gameData, publisher);
    });

    it("inherit Core.BaseEventConsumers.PlaceBetConsumer", () => {
        // Assert
        expect(consumer instanceof Core.BaseEventConsumers.PlaceBetConsumer);
    });

    describe("composeValidationCriteria", () => {
        it("should return combined results of all validation criteria", () => {
            // Arrange
            jest.spyOn(consumer, "composeBettingTimeValidationCriteria").mockReturnValue([{ failure: false }]);
            jest.spyOn(consumer, "composeMultiplierModeValidationCriteria").mockReturnValue([{ failure: false }]);
            jest.spyOn(consumer, "composeBetAmountValidationCriteria").mockReturnValue([{ failure: false }]);
            jest.spyOn(consumer, "composeClientSeedValidationCriteria").mockReturnValue([{ failure: false }]);
            const expectedValue = [{ failure: false }, { failure: false }, { failure: false }, { failure: false }];

            // Act
            const actualValue = consumer.composeValidationCriteria(player, payload);

            // Assert
            expect(actualValue).toStrictEqual(expectedValue);
        });

        it("should call composeBettingTimeValidationCriteria with player", () => {
            // Arrange
            jest.spyOn(consumer, "composeBettingTimeValidationCriteria").mockReturnValue([{ failure: false }]);
            jest.spyOn(consumer, "composeMultiplierModeValidationCriteria").mockReturnValue([{ failure: false }]);
            jest.spyOn(consumer, "composeBetAmountValidationCriteria").mockReturnValue([{ failure: false }]);
            jest.spyOn(consumer, "composeClientSeedValidationCriteria").mockReturnValue([{ failure: false }]);

            // Act
            consumer.composeValidationCriteria(player, payload);

            // Assert
            expect(consumer.composeBettingTimeValidationCriteria).toHaveBeenCalledWith(player);
        });

        it("should call composeBetAmountValidationCriteria with player and amount", () => {
            // Arrange
            jest.spyOn(consumer, "composeBettingTimeValidationCriteria").mockReturnValue([{ failure: false }]);
            jest.spyOn(consumer, "composeMultiplierModeValidationCriteria").mockReturnValue([{ failure: false }]);
            jest.spyOn(consumer, "composeBetAmountValidationCriteria").mockReturnValue([{ failure: false }]);
            jest.spyOn(consumer, "composeClientSeedValidationCriteria").mockReturnValue([{ failure: false }]);

            // Act
            consumer.composeValidationCriteria(player, payload);

            // Assert
            expect(consumer.composeBetAmountValidationCriteria).toHaveBeenCalledWith(player, payload.amount);
        });

        it("should call composeClientSeedValidationCriteria with clientSeed", () => {
            // Arrange
            jest.spyOn(consumer, "composeBettingTimeValidationCriteria").mockReturnValue([{ failure: false }]);
            jest.spyOn(consumer, "composeMultiplierModeValidationCriteria").mockReturnValue([{ failure: false }]);
            jest.spyOn(consumer, "composeBetAmountValidationCriteria").mockReturnValue([{ failure: false }]);
            jest.spyOn(consumer, "composeClientSeedValidationCriteria").mockReturnValue([{ failure: false }]);

            // Act
            consumer.composeValidationCriteria(player, payload);

            // Assert
            expect(consumer.composeClientSeedValidationCriteria).toHaveBeenCalledWith(payload.clientSeed);
        });
    });

    describe("composeBettingTimeValidationCriteria", () => {
        it("should return failure when game is disabled", () => {
            // Arrange
            consumer.gameData.gameConfigs.enabled = false;

            // Act
            const result = consumer.composeBettingTimeValidationCriteria(player);

            // Assert
            expect(result[0].failure).toBe(true);
        });

        it("should return correct error code when game is disabled", () => {
            // Arrange
            consumer.gameData.gameConfigs.enabled = false;

            // Act
            const result = consumer.composeBettingTimeValidationCriteria(player);

            // Assert
            expect(result[0].notice.errorCode).toBe(helpers.noticeHelper.invalidBet);
        });

        it("should return failure when player has active bet", () => {
            // Arrange
            consumer.gameData.ingame[player.profile.name] = {
                activeBet: {
                    amount: 1,
                    roundId: 1,
                    currentMultiplier: 1.5,
                    tapCount: 5,
                    maxWin: 1000,
                },
            };

            // Act
            const result = consumer.composeBettingTimeValidationCriteria(player);

            // Assert
            expect(result[0].failure).toBe(true);
        });

        it("should return correct error code when player has active bet", () => {
            // Arrange
            consumer.gameData.ingame[player.profile.name] = {
                activeBet: {
                    amount: 1,
                    roundId: 1,
                    currentMultiplier: 1.5,
                    tapCount: 5,
                    maxWin: 1000,
                },
            };

            // Act
            const result = consumer.composeBettingTimeValidationCriteria(player);

            // Assert
            expect(result[0].notice.errorCode).toBe(helpers.noticeHelper.invalidBet);
        });

        it("should return no failure when game is enabled and player does not have active bet", () => {
            // Arrange
            consumer.gameData.gameConfigs.enabled = true;
            consumer.gameData.ingame[player.profile.name] = {
                activeBet: null,
            };

            // Act
            const result = consumer.composeBettingTimeValidationCriteria(player);

            // Assert
            expect(result[0].failure).toBe(false);
        });

        it("should return correct error code when game is enabled and player does not have active bet", () => {
            // Arrange
            consumer.gameData.gameConfigs.enabled = true;
            consumer.gameData.ingame[player.profile.name] = {
                activeBet: null,
            };

            // Act
            const result = consumer.composeBettingTimeValidationCriteria(player);

            // Assert
            expect(result[0].notice.errorCode).toBe(helpers.noticeHelper.invalidBet);
        });
    });

    describe("composeBetAmountValidationCriteria", () => {
        it("should return failure when amount is below min bet", () => {
            // Arrange
            const amount = 3; // Below min bet of 6

            // Act
            const result = consumer.composeBetAmountValidationCriteria(player, amount);

            // Assert
            expect(result[0].failure).toBe(true);
        });

        it("should return min bet error code when amount is below min bet", () => {
            // Arrange
            const amount = 3; // Below min bet of 6

            // Act
            const result = consumer.composeBetAmountValidationCriteria(player, amount);

            // Assert
            expect(result[0].notice.errorCode).toBe(helpers.noticeHelper.minBet);
        });

        it("should return correct min bet value when amount is below min bet", () => {
            // Arrange
            const amount = 3; // Below min bet of 6

            // Act
            const result = consumer.composeBetAmountValidationCriteria(player, amount);

            // Assert
            expect(result[0].notice.minBet).toBe(6);
        });

        it("should return failure when amount is above max bet", () => {
            // Arrange
            const amount = 20; // Above max bet of 8

            // Act
            const result = consumer.composeBetAmountValidationCriteria(player, amount);

            // Assert
            expect(result[1].failure).toBe(true);
        });

        it("should return max bet error code when amount is above max bet", () => {
            // Arrange
            const amount = 20; // Above max bet of 8

            // Act
            const result = consumer.composeBetAmountValidationCriteria(player, amount);

            // Assert
            expect(result[1].notice.errorCode).toBe(helpers.noticeHelper.maxBet);
        });

        it("should return correct max bet value when amount is above max bet", () => {
            // Arrange
            const amount = 20; // Above max bet of 8

            // Act
            const result = consumer.composeBetAmountValidationCriteria(player, amount);

            // Assert
            expect(result[1].notice.maxBet).toBe(8);
        });

        it("should return no failure for min bet when amount is within limits", () => {
            // Arrange
            const amount = 7; // Within limits (6-8)

            // Act
            const result = consumer.composeBetAmountValidationCriteria(player, amount);

            // Assert
            expect(result[0].failure).toBe(false);
        });

        it("should return no failure for max bet when amount is within limits", () => {
            // Arrange
            const amount = 7; // Within limits (6-8)

            // Act
            const result = consumer.composeBetAmountValidationCriteria(player, amount);

            // Assert
            expect(result[1].failure).toBe(false);
        });

        it("should return failure when amount is between settings and player min bet", () => {
            // Arrange
            const amount = 5; // Between settings min (4) and player min (6)

            // Act
            const result = consumer.composeBetAmountValidationCriteria(player, amount);

            // Assert
            expect(result[0].failure).toBe(true);
        });

        it("should use player min bet when amount is between settings and player min bet", () => {
            // Arrange
            const amount = 5; // Between settings min (4) and player min (6)

            // Act
            const result = consumer.composeBetAmountValidationCriteria(player, amount);

            // Assert
            expect(result[0].notice.minBet).toBe(6); // Should use player min bet
        });

        it("should return failure when amount is between player and settings max bet", () => {
            // Arrange
            const amount = 15; // Between player max (8) and settings max (18)

            // Act
            const result = consumer.composeBetAmountValidationCriteria(player, amount);

            // Assert
            expect(result[1].failure).toBe(true);
        });

        it("should use player max bet when amount is between player and settings max bet", () => {
            // Arrange
            const amount = 15; // Between player max (8) and settings max (18)

            // Act
            const result = consumer.composeBetAmountValidationCriteria(player, amount);

            // Assert
            expect(result[1].notice.maxBet).toBe(8); // Should use player max bet
        });

        it("should return failure when float amount is below min bet", () => {
            // Arrange
            const amount = 5.5; // Below min bet of 6

            // Act
            const result = consumer.composeBetAmountValidationCriteria(player, amount);

            // Assert
            expect(result[0].failure).toBe(true);
        });

        it("should return failure when float amount is above max bet", () => {
            // Arrange
            const amount = 8.5; // Above max bet of 8

            // Act
            const result = consumer.composeBetAmountValidationCriteria(player, amount);

            // Assert
            expect(result[1].failure).toBe(true);
        });

        it("should return no failure for float amount within limits", () => {
            // Arrange
            const amount = 7.5; // Within limits (6-8)

            // Act
            const result = consumer.composeBetAmountValidationCriteria(player, amount);

            // Assert
            expect(result[0].failure).toBe(false);
            expect(result[1].failure).toBe(false);
        });

        it("should handle decimal amounts correctly in validation", () => {
            // Arrange
            const amount = 6.99; // Just below 7, within limits

            // Act
            const result = consumer.composeBetAmountValidationCriteria(player, amount);

            // Assert
            expect(result[0].failure).toBe(false);
            expect(result[1].failure).toBe(false);
        });
    });

    describe("composeClientSeedValidationCriteria", () => {
        it("should return failure for invalid client seeds (empty, null, undefined, >4 chars, non-numeric, decimal)", () => {
            const invalidSeeds = [
                "",
                null,
                undefined,
                "12345",
                "abc",
                "12.34"
            ];

            invalidSeeds.forEach(seed => {
                const result = consumer.composeClientSeedValidationCriteria(seed);
                expect(result[0].failure).toBe(true);
            });
        });

        it("should return correct error code for invalid client seed", () => {
            // Arrange
            const seed = "";

            // Act
            const result = consumer.composeClientSeedValidationCriteria(seed);

            // Assert
            expect(result[0].notice.errorCode).toBe(helpers.noticeHelper.invalidBet);
        });

        it("should return no failure for valid client seeds (1-4 digit numeric)", () => {
            const validSeeds = ["123", "999", "0000", "1"];
            validSeeds.forEach(seed => {
                const result = consumer.composeClientSeedValidationCriteria(seed);
                expect(result[0].failure).toBe(false);
            });
        });
    });

    describe("validateBetRequest", () => {
        it("should return false when validation fails", () => {
            // Arrange
            jest.spyOn(consumer, "composeValidationCriteria").mockReturnValue([
                { failure: true, notice: { errorCode: "SB1909" } }
            ]);
            jest.spyOn(consumer.publisher, "publishToUser");

            // Act
            const result = consumer.validateBetRequest(player, payload);

            // Assert
            expect(result).toBe(false);
        });

        it("should publish error to user when validation fails", () => {
            // Arrange
            jest.spyOn(consumer, "composeValidationCriteria").mockReturnValue([
                { failure: true, notice: { errorCode: "SB1909" } }
            ]);
            jest.spyOn(consumer.publisher, "publishToUser");

            // Act
            consumer.validateBetRequest(player, payload);

            // Assert
            expect(consumer.publisher.publishToUser).toHaveBeenCalledWith(player.UID, {
                endBet: -1,
                notice: { errorCode: "SB1909" }
            });
        });

        it("should return true when validation passes", () => {
            // Arrange
            jest.spyOn(consumer, "composeValidationCriteria").mockReturnValue([
                { failure: false, notice: { errorCode: "SB1909" } }
            ]);

            // Act
            const result = consumer.validateBetRequest(player, payload);

            // Assert
            expect(result).toBe(true);
        });
    });

    describe("validateMineRequest", () => {
        it("should return false when player has no bet", () => {
            // Arrange
            consumer.gameData.ingame[player.profile.name] = {
                betTracks: {}
            };
            jest.spyOn(consumer.publisher, "publishToUser");

            // Act
            const result = consumer.validateMineRequest(player);

            // Assert
            expect(result).toBe(false);
        });

        it("should publish invalid mine notice when player has no bet", () => {
            // Arrange
            consumer.gameData.ingame[player.profile.name] = {
                betTracks: {}
            };
            jest.spyOn(consumer.publisher, "publishToUser");

            // Act
            consumer.validateMineRequest(player);

            // Assert
            expect(consumer.publisher.publishToUser).toHaveBeenCalledWith(player.UID, {
                endBet: -1,
                notice: helpers.noticeHelper.invalidMine
            });
        });

        it("should return false when player has already cashed out", () => {
            // Arrange
            consumer.gameData.ingame[player.profile.name] = {
                betTracks: {
                    [Actions.Bet]: { time: new Date() },
                    [Actions.CashOut]: { time: new Date() }
                }
            };
            jest.spyOn(consumer.publisher, "publishToUser");

            // Act
            const result = consumer.validateMineRequest(player);

            // Assert
            expect(result).toBe(false);
        });

        it("should return true when player has valid bet", () => {
            // Arrange
            consumer.gameData.ingame[player.profile.name] = {
                betTracks: {
                    [Actions.Bet]: { time: new Date() }
                }
            };

            // Act
            const result = consumer.validateMineRequest(player);

            // Assert
            expect(result).toBe(true);
        });
    });

    describe("consume", () => {
        beforeEach(() => {
            jest.spyOn(consumer, "validateBetRequest").mockReturnValue(true);
            jest.spyOn(consumer, "validateMineRequest").mockReturnValue(true);
            jest.spyOn(consumer, "adjustBetTracks");
            gameData.ingame = {};
        });

        it("should increment roundId for Bet action", () => {
            // Arrange
            const initialRoundId = gameData.roundId;
            const betPayload = { ...payload, action: Actions.Bet };

            // Act
            consumer.consume(player, betPayload);

            // Assert
            expect(gameData.roundId).toBe(initialRoundId + 1);
        });

        it("should not increment roundId for Mine action", () => {
            // Arrange
            const initialRoundId = gameData.roundId;
            const minePayload = { ...payload, action: Actions.Mine };

            // Act
            consumer.consume(player, minePayload);

            // Assert
            expect(gameData.roundId).toBe(initialRoundId);
        });

        it("should preserve amount as float when provided", () => {
            // Arrange
            const floatPayload = { ...payload, amount: 10.5 };

            // Act
            consumer.consume(player, floatPayload);

            // Assert
            expect(floatPayload.amount).toBe(10.5); // Should preserve float value
        });

        it("should preserve amount as integer when provided", () => {
            // Act
            consumer.consume(player, payload);

            // Assert
            expect(payload.amount).toBe(10); // Should preserve integer value
        });

        it("should set receivedTime to current date", () => {
            // Act
            consumer.consume(player, payload);

            // Assert
            expect(payload.receivedTime).toBeInstanceOf(Date);
        });

        it("should set mode from payload.m", () => {
            // Act
            consumer.consume(player, payload);

            // Assert
            expect(payload.mode).toBe("1"); // Should use payload.m or default to Landscape
        });

        it("should set roundId from gameData", () => {
            // Act
            consumer.consume(player, payload);

            // Assert
            expect(payload.roundId).toBe(gameData.roundId);
        });

        it("should preserve clientSeed", () => {
            // Act
            consumer.consume(player, payload);

            // Assert
            expect(payload.clientSeed).toBe("999");
        });

        it("should use default mode when payload.m is not provided", () => {
            // Arrange
            const payloadWithoutMode = { ...payload };
            delete payloadWithoutMode.m;

            // Act
            consumer.consume(player, payloadWithoutMode);

            // Assert
            expect(payloadWithoutMode.mode).toBe(consumer.DisplayMode.Landscape);
        });

        it("should validate bet request for Bet action", () => {
            // Act
            consumer.consume(player, payload);

            // Assert
            expect(consumer.validateBetRequest).toHaveBeenCalledWith(player, payload);
        });

        it("should validate mine request for Mine action", () => {
            // Arrange
            const minePayload = { ...payload, action: Actions.Mine };

            // Act
            consumer.consume(player, minePayload);

            // Assert
            expect(consumer.validateMineRequest).toHaveBeenCalledWith(player);
        });

        it("should not process when validation fails", () => {
            // Arrange
            consumer.validateBetRequest.mockReturnValue(false);

            // Act
            consumer.consume(player, payload);

            // Assert
            expect(consumer.adjustBetTracks).not.toHaveBeenCalled();
            expect(gameData.ingame[player.profile.name]).toBeUndefined();
        });

        it("should create player in gameData when not exists", () => {
            // Act
            consumer.consume(player, payload);

            // Assert
            expect(gameData.ingame[player.profile.name]).toBeDefined();
        });

        it("should set correct player properties when creating player", () => {
            // Act
            consumer.consume(player, payload);

            // Assert
            const createdPlayer = gameData.ingame[player.profile.name];
            expect(createdPlayer.name).toBe(player.profile.name);
            expect(createdPlayer.currency).toBe(player.session.currencyName);
            expect(createdPlayer.system).toBe(player.session.system);
            expect(createdPlayer.operatorId).toBe(player.session.operatorId);
        });

        it("should initialize betTracks when creating player", () => {
            // Arrange
            jest.spyOn(consumer, "adjustBetTracks").mockImplementation(() => {});

            // Act
            consumer.consume(player, payload);

            // Assert
            expect(gameData.ingame[player.profile.name].betTracks).toEqual({});
        });

        it("should initialize betQueue as array when creating player", () => {
            // Act
            consumer.consume(player, payload);

            // Assert
            expect(Array.isArray(gameData.ingame[player.profile.name].betQueue)).toBe(true);
        });

        it("should initialize betQueue if not exists", () => {
            // Arrange
            gameData.ingame[player.profile.name] = {
                name: player.profile.name,
                currency: player.session.currencyName,
                system: player.session.system,
                operatorId: player.session.operatorId,
                betTracks: {},
            };

            // Act
            consumer.consume(player, payload);

            // Assert
            expect(gameData.ingame[player.profile.name].betQueue).toBeDefined();
        });

        it("should initialize betQueue as array if not exists", () => {
            // Arrange
            gameData.ingame[player.profile.name] = {
                name: player.profile.name,
                currency: player.session.currencyName,
                system: player.session.system,
                operatorId: player.session.operatorId,
                betTracks: {},
            };

            // Act
            consumer.consume(player, payload);

            // Assert
            expect(Array.isArray(gameData.ingame[player.profile.name].betQueue)).toBe(true);
        });

        it("should call adjustBetTracks", () => {
            // Act
            consumer.consume(player, payload);

            // Assert
            expect(consumer.adjustBetTracks).toHaveBeenCalledWith(player.profile.name, payload);
        });

        it("should add bet to queue", () => {
            // Act
            consumer.consume(player, payload);

            // Assert
            expect(gameData.ingame[player.profile.name].betQueue.length).toBe(1);
        });

        it("should add correct bet data to queue", () => {
            // Act
            consumer.consume(player, payload);

            // Assert
            expect(gameData.ingame[player.profile.name].betQueue[0]).toEqual({
                player,
                payload: {
                    action: payload.action,
                    bet: payload,
                },
            });
        });
    });

    describe("adjustBetTracks", () => {
        it("should update player betTracks with correct properties", () => {
            // Arrange
            gameData.ingame[player.profile.name] = { betTracks: {} };
            const bet = {
                action: Actions.Bet,
                amount: 10,
                receivedTime: new Date(),
                roundId: 1,
            };

            // Act
            consumer.adjustBetTracks(player.profile.name, bet);

            // Assert
            const betTrack = gameData.ingame[player.profile.name].betTracks[Actions.Bet];
            expect(betTrack.amount).toBe(10);
            expect(betTrack.time).toBe(bet.receivedTime);
            expect(betTrack.roundId).toBe(1);
            expect(betTrack.tapCount).toBe(1);
            expect(betTrack.multiplier).toBe(1);
        });

        it("should not throw when player does not exist", () => {
            // Arrange
            const bet = {
                action: Actions.Bet,
                amount: 10,
                receivedTime: new Date(),
                roundId: 1,
            };

            // Act & Assert
            expect(() => {
                consumer.adjustBetTracks("nonexistent", bet);
            }).not.toThrow();
        });

        it("should handle float amounts in bet tracks", () => {
            // Arrange
            gameData.ingame[player.profile.name] = { betTracks: {} };
            const bet = {
                action: Actions.Bet,
                amount: 7.5,
                receivedTime: new Date(),
                roundId: 1,
            };

            // Act
            consumer.adjustBetTracks(player.profile.name, bet);

            // Assert
            const betTrack = gameData.ingame[player.profile.name].betTracks[Actions.Bet];
            expect(betTrack.amount).toBe(7.5);
            expect(betTrack.time).toBe(bet.receivedTime);
            expect(betTrack.roundId).toBe(1);
            expect(betTrack.tapCount).toBe(1);
            expect(betTrack.multiplier).toBe(1);
        });
    });
});