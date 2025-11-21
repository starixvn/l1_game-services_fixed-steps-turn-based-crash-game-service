import Chance from "chance";
import { Systems } from "sc-game-base/src/constants";
import { RecentBetConsumer } from "../../consumers";
import CrashGameData from "../../game-data";
import RecentBetPublisher from "../recent-bet-publisher";

const chance = new Chance();

xdescribe("RecentBetPublisher", () => {
    /**
     * @type {RecentBetPublisher}
     */
    let publisher;
    let gameData;
    /**
     * @type {RecentBetConsumer}
     */
    let recentBetConsumer;
    let gameName;

    beforeEach(() => {
        gameName = chance.string({ length: 10 });
        gameData = new CrashGameData(10);
        recentBetConsumer = {
            updateExchangeRateCode: jest.fn(),
        };

        publisher = new RecentBetPublisher(gameName, gameData, recentBetConsumer);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("Constructor", () => {
        it("should initialize with correct dependencies", () => {
            // Assert
            expect(publisher.gameName).toBe(gameName);
            expect(publisher.gameData).toBe(gameData);
            expect(publisher.recentBetConsumer).toBe(recentBetConsumer);
        });
    });

    describe("publish", () => {
        const recentBet = {
            name: chance.name(),
            amount: chance.natural({ min: 100, max: 10000 }),
            multiplier: chance.floating({ min: 2, max: 10 }),
            time: new Date(),
        };

        beforeEach(() => {
            gameData.realPlayers = {
                player1: {
                    session: { system: Systems.Mobi },
                    socketClient: { emit: jest.fn() },
                },
                player2: {
                    session: { system: 1 },
                    socketClient: { emit: jest.fn() },
                },
                player3: {
                    session: { system: 3 },
                    socketClient: { emit: jest.fn() },
                },
                player4: {
                    session: null,
                    socketClient: { emit: jest.fn() },
                },
                player5: {
                    socketClient: { emit: jest.fn() },
                },
            };
        });

        it("should filter out Mobi system players", () => {
            // Act
            publisher.publish(recentBet);

            // Assert
            expect(recentBetConsumer.updateExchangeRateCode).toHaveBeenCalledTimes(4); // player2, player3, player4, player5
            expect(recentBetConsumer.updateExchangeRateCode).not.toHaveBeenCalledWith(
                expect.objectContaining({ session: { system: Systems.Mobi } }),
                expect.any(Array)
            );
        });

        it("should call updateExchangeRateCode for each non-Mobi player", () => {
            // Act
            publisher.publish(recentBet);

            // Assert
            expect(recentBetConsumer.updateExchangeRateCode).toHaveBeenCalledWith(gameData.realPlayers.player2, [recentBet]);
            expect(recentBetConsumer.updateExchangeRateCode).toHaveBeenCalledWith(gameData.realPlayers.player3, [recentBet]);
            expect(recentBetConsumer.updateExchangeRateCode).toHaveBeenCalledWith(gameData.realPlayers.player4, [recentBet]);
            expect(recentBetConsumer.updateExchangeRateCode).toHaveBeenCalledWith(gameData.realPlayers.player5, [recentBet]);
        });

        it("should emit to socket for each non-Mobi player", () => {
            // Act
            publisher.publish(recentBet);

            // Assert
            expect(gameData.realPlayers.player2.socketClient.emit).toHaveBeenCalledWith(gameName, {
                recentBet,
            });
            expect(gameData.realPlayers.player3.socketClient.emit).toHaveBeenCalledWith(gameName, {
                recentBet,
            });
            expect(gameData.realPlayers.player4.socketClient.emit).toHaveBeenCalledWith(gameName, {
                recentBet,
            });
            expect(gameData.realPlayers.player5.socketClient.emit).toHaveBeenCalledWith(gameName, {
                recentBet,
            });
        });

        it("should not emit to Mobi system players", () => {
            // Act
            publisher.publish(recentBet);

            // Assert
            expect(gameData.realPlayers.player1.socketClient.emit).not.toHaveBeenCalled();
        });

        it("should handle players with null session", () => {
            // Act
            publisher.publish(recentBet);

            // Assert
            expect(recentBetConsumer.updateExchangeRateCode).toHaveBeenCalledWith(gameData.realPlayers.player4, [recentBet]);
            expect(gameData.realPlayers.player4.socketClient.emit).toHaveBeenCalledWith(gameName, {
                recentBet,
            });
        });

        it("should handle players with undefined session", () => {
            // Act
            publisher.publish(recentBet);

            // Assert
            expect(recentBetConsumer.updateExchangeRateCode).toHaveBeenCalledWith(gameData.realPlayers.player5, [recentBet]);
            expect(gameData.realPlayers.player5.socketClient.emit).toHaveBeenCalledWith(gameName, {
                recentBet,
            });
        });

        it("should handle empty realPlayers object", () => {
            // Arrange
            gameData.realPlayers = {};

            // Act
            publisher.publish(recentBet);

            // Assert
            expect(recentBetConsumer.updateExchangeRateCode).not.toHaveBeenCalled();
        });

        it("should handle undefined realPlayers", () => {
            // Arrange
            gameData.realPlayers = undefined;

            // Act & Assert
            expect(() => publisher.publish(recentBet)).toThrow();
        });

        it("should handle null realPlayers", () => {
            // Arrange
            gameData.realPlayers = null;

            // Act & Assert
            expect(() => publisher.publish(recentBet)).toThrow();
        });

        it("should handle players with different system values", () => {
            // Arrange
            gameData.realPlayers = {
                webPlayer: {
                    session: { system: 1 },
                    socketClient: { emit: jest.fn() },
                },
                mobilePlayer: {
                    session: { system: 3 },
                    socketClient: { emit: jest.fn() },
                },
                apiPlayer: {
                    session: { system: 4 },
                    socketClient: { emit: jest.fn() },
                },
            };

            // Act
            publisher.publish(recentBet);

            // Assert
            expect(recentBetConsumer.updateExchangeRateCode).toHaveBeenCalledTimes(3);
            expect(gameData.realPlayers.webPlayer.socketClient.emit).toHaveBeenCalledWith(gameName, {
                recentBet,
            });
            expect(gameData.realPlayers.mobilePlayer.socketClient.emit).toHaveBeenCalledWith(gameName, {
                recentBet,
            });
            expect(gameData.realPlayers.apiPlayer.socketClient.emit).toHaveBeenCalledWith(gameName, {
                recentBet,
            });
        });

        it("should handle recentBet", () => {
            // Arrange
            const recentBet = {
                name: chance.name(),
                amount: chance.natural({ min: 100, max: 10000 }),
                multiplier: chance.floating({ min: 2, max: 10 }),
                time: new Date(),
            };

            gameData.realPlayers = {
                player1: {
                    session: { system: 1 },
                    socketClient: { emit: jest.fn() },
                },
            };

            // Act
            publisher.publish(recentBet);

            // Assert
            expect(recentBetConsumer.updateExchangeRateCode).toHaveBeenCalledWith(gameData.realPlayers.player1, [recentBet]);
            expect(gameData.realPlayers.player1.socketClient.emit).toHaveBeenCalledWith(gameName, {
                recentBet,
            });
        });

        it("should return early when recentBet is null", () => {
            // Arrange
            gameData.realPlayers = {
                player1: {
                    session: { system: 1 },
                    socketClient: { emit: jest.fn() },
                },
            };

            // Act
            publisher.publish(null);

            // Assert
            expect(recentBetConsumer.updateExchangeRateCode).not.toHaveBeenCalled();
            expect(gameData.realPlayers.player1.socketClient.emit).not.toHaveBeenCalled();
        });

        it("should return early when recentBet is undefined", () => {
            // Arrange
            gameData.realPlayers = {
                player1: {
                    session: { system: 1 },
                    socketClient: { emit: jest.fn() },
                },
            };

            // Act
            publisher.publish(undefined);

            // Assert
            expect(recentBetConsumer.updateExchangeRateCode).not.toHaveBeenCalled();
            expect(gameData.realPlayers.player1.socketClient.emit).not.toHaveBeenCalled();
        });

        it("should return early when recentBet is falsy", () => {
            // Arrange
            gameData.realPlayers = {
                player1: {
                    session: { system: 1 },
                    socketClient: { emit: jest.fn() },
                },
            };

            // Act
            publisher.publish(false);

            // Assert
            expect(recentBetConsumer.updateExchangeRateCode).not.toHaveBeenCalled();
            expect(gameData.realPlayers.player1.socketClient.emit).not.toHaveBeenCalled();
        });
    });
});
