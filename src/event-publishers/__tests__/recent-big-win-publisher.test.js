import Chance from "chance";
import { Systems } from "sc-game-base/src/constants";
import CrashGameData from "../../game-data";
import RecentBigWinPublisher from "../recent-big-win-publisher";

const chance = new Chance();

describe("RecentBigWinPublisher", () => {
    /**
     * @type {RecentBigWinPublisher}
     */
    let publisher;
    let gameData;
    let bigWinConsumer;
    let gameName;

    beforeEach(() => {
        gameName = chance.string({ length: 10 });
        gameData = new CrashGameData(10);
        bigWinConsumer = {
            updateExchangeRateCode: jest.fn(),
        };

        publisher = new RecentBigWinPublisher(gameName, gameData, bigWinConsumer);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("Constructor", () => {
        it("should initialize with correct dependencies", () => {
            // Assert
            expect(publisher.gameName).toBe(gameName);
            expect(publisher.gameData).toBe(gameData);
            expect(publisher.bigWinConsumer).toBe(bigWinConsumer);
        });
    });

    describe("publish", () => {
        const recentBigWinningWinner = {
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
            publisher.publish(recentBigWinningWinner);

            // Assert
            expect(bigWinConsumer.updateExchangeRateCode).toHaveBeenCalledTimes(4); // player2, player3, player4, player5
            expect(bigWinConsumer.updateExchangeRateCode).not.toHaveBeenCalledWith(
                expect.objectContaining({ session: { system: Systems.Mobi } }),
                expect.any(Array)
            );
        });

        it("should call updateExchangeRateCode for each non-Mobi player", () => {
            // Act
            publisher.publish(recentBigWinningWinner);

            // Assert
            expect(bigWinConsumer.updateExchangeRateCode).toHaveBeenCalledWith(gameData.realPlayers.player2, [recentBigWinningWinner]);
            expect(bigWinConsumer.updateExchangeRateCode).toHaveBeenCalledWith(gameData.realPlayers.player3, [recentBigWinningWinner]);
            expect(bigWinConsumer.updateExchangeRateCode).toHaveBeenCalledWith(gameData.realPlayers.player4, [recentBigWinningWinner]);
            expect(bigWinConsumer.updateExchangeRateCode).toHaveBeenCalledWith(gameData.realPlayers.player5, [recentBigWinningWinner]);
        });

        it("should emit to socket for each non-Mobi player", () => {
            // Act
            publisher.publish(recentBigWinningWinner);

            // Assert
            expect(gameData.realPlayers.player2.socketClient.emit).toHaveBeenCalledWith(gameName, {
                recentBigWinningWinner,
            });
            expect(gameData.realPlayers.player3.socketClient.emit).toHaveBeenCalledWith(gameName, {
                recentBigWinningWinner,
            });
            expect(gameData.realPlayers.player4.socketClient.emit).toHaveBeenCalledWith(gameName, {
                recentBigWinningWinner,
            });
            expect(gameData.realPlayers.player5.socketClient.emit).toHaveBeenCalledWith(gameName, {
                recentBigWinningWinner,
            });
        });

        it("should not emit to Mobi system players", () => {
            // Act
            publisher.publish(recentBigWinningWinner);

            // Assert
            expect(gameData.realPlayers.player1.socketClient.emit).not.toHaveBeenCalled();
        });

        it("should handle players with null session", () => {
            // Act
            publisher.publish(recentBigWinningWinner);

            // Assert
            expect(bigWinConsumer.updateExchangeRateCode).toHaveBeenCalledWith(gameData.realPlayers.player4, [recentBigWinningWinner]);
            expect(gameData.realPlayers.player4.socketClient.emit).toHaveBeenCalledWith(gameName, {
                recentBigWinningWinner,
            });
        });

        it("should handle players with undefined session", () => {
            // Act
            publisher.publish(recentBigWinningWinner);

            // Assert
            expect(bigWinConsumer.updateExchangeRateCode).toHaveBeenCalledWith(gameData.realPlayers.player5, [recentBigWinningWinner]);
            expect(gameData.realPlayers.player5.socketClient.emit).toHaveBeenCalledWith(gameName, {
                recentBigWinningWinner,
            });
        });

        it("should handle empty realPlayers object", () => {
            // Arrange
            gameData.realPlayers = {};

            // Act
            publisher.publish(recentBigWinningWinner);

            // Assert
            expect(bigWinConsumer.updateExchangeRateCode).not.toHaveBeenCalled();
        });

        it("should handle undefined realPlayers", () => {
            // Arrange
            gameData.realPlayers = undefined;

            // Act & Assert
            expect(() => publisher.publish(recentBigWinningWinner)).toThrow();
        });

        it("should handle null realPlayers", () => {
            // Arrange
            gameData.realPlayers = null;

            // Act & Assert
            expect(() => publisher.publish(recentBigWinningWinner)).toThrow();
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
            publisher.publish(recentBigWinningWinner);

            // Assert
            expect(bigWinConsumer.updateExchangeRateCode).toHaveBeenCalledTimes(3);
            expect(gameData.realPlayers.webPlayer.socketClient.emit).toHaveBeenCalledWith(gameName, {
                recentBigWinningWinner,
            });
            expect(gameData.realPlayers.mobilePlayer.socketClient.emit).toHaveBeenCalledWith(gameName, {
                recentBigWinningWinner,
            });
            expect(gameData.realPlayers.apiPlayer.socketClient.emit).toHaveBeenCalledWith(gameName, {
                recentBigWinningWinner,
            });
        });

        it("should handle recentBigWinningWinner", () => {
            // Arrange
            const bigWinner = {
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
            publisher.publish(bigWinner);

            // Assert
            expect(bigWinConsumer.updateExchangeRateCode).toHaveBeenCalledWith(gameData.realPlayers.player1, [bigWinner]);
            expect(gameData.realPlayers.player1.socketClient.emit).toHaveBeenCalledWith(gameName, {
                recentBigWinningWinner: bigWinner,
            });
        });
    });
});
