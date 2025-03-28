import { stub } from "jest-micro-auto-stub";
import { Core } from "sc-game-base";
import { SettleCashOutConsumer, UserDisconnectConsumer } from "../../consumers";
import { BaseEventPublisher } from "sc-game-base/src/core/event-publishers";

import Chance from "chance";
describe("UserDisconnectConsumer", () => {
    const chance = new Chance();

    /** @type {UserDisconnectConsumer}*/
    let consumer;
    let gameData;
    /** @type {BaseEventPublisher}*/
    let publisher;
    let betLogsRepository;
    /** @type {SettleCashOutConsumer}*/
    let settleCashOutConsumer;
    let socketClient;

    beforeEach(() => {
        // Arrange - Common setup
        gameData = {
            realPlayers: {},
        };
        publisher = {
            publishToAllUsersExceptSystem: jest.fn(),
        };
        betLogsRepository = {};
        settleCashOutConsumer = stub(SettleCashOutConsumer);
        socketClient = {
            id: "test-socket-id",
        };

        // Mock super class consume
        jest.spyOn(Core.BaseEventConsumers.UserDisconnectConsumer.prototype, "consume").mockImplementation(() => {});

        consumer = new UserDisconnectConsumer({
            gameData,
            publisher,
            betLogsRepository,
            settleCashOutConsumer,
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("consume", () => {
        describe("when player is not found", () => {
            beforeEach(() => {
                gameData.realPlayers = {};
            });

            it("should not call super.consume and cash out", async () => {
                // Act
                await consumer.consume(socketClient);

                // Assert
                expect(settleCashOutConsumer.validateCashOut).not.toHaveBeenCalled();
                expect(settleCashOutConsumer.proceedCashOut).not.toHaveBeenCalled();
                expect(Core.BaseEventConsumers.UserDisconnectConsumer.prototype.consume).not.toHaveBeenCalledWith(socketClient);
            });
        });

        describe("when player is found", () => {
            const mockPlayer = { id: "test-socket-id", profile: { name: "test-player" } };

            beforeEach(() => {
                consumer.gameData = {
                    realPlayers: {
                        [socketClient.id]: mockPlayer,
                    },
                    provablyFair: {
                        [mockPlayer.profile.name]: {
                            serverSeed: chance.string(),
                            serverSeedHash: chance.string(),
                        },
                    },
                    ingame: {
                        [mockPlayer.profile.name]: {
                            betTracks: {},
                        },
                    },
                    players: {
                        [mockPlayer.UID]: {
                            profile: mockPlayer.profile,
                        },
                    },
                };
            });

            describe("with invalid cash out", () => {
                beforeEach(() => {
                    settleCashOutConsumer.validateCashOut.mockReturnValue(false);
                });

                it("should validate cash out with player", async () => {
                    // Act
                    await consumer.consume(socketClient);

                    // Assert
                    expect(settleCashOutConsumer.validateCashOut).toHaveBeenCalledWith(mockPlayer);
                });

                it("should not proceed with cash out", async () => {
                    // Act
                    await consumer.consume(socketClient);

                    // Assert
                    expect(settleCashOutConsumer.proceedCashOut).not.toHaveBeenCalled();
                });

                it("should call super.consume", async () => {
                    // Act
                    await consumer.consume(socketClient);

                    // Assert
                    expect(Core.BaseEventConsumers.UserDisconnectConsumer.prototype.consume).toHaveBeenCalledWith(socketClient);
                });
            });

            describe("with valid cash out", () => {
                beforeEach(() => {
                    settleCashOutConsumer.validateCashOut.mockReturnValue(true);
                });

                it("should proceed with cash out using correct parameters", async () => {
                    // Act
                    await consumer.consume(socketClient);

                    // Assert
                    expect(settleCashOutConsumer.proceedCashOut).toHaveBeenCalledWith(mockPlayer, true);
                });

                it("should call super.consume after cash out", async () => {
                    // Act
                    await consumer.consume(socketClient);

                    // Assert
                    expect(Core.BaseEventConsumers.UserDisconnectConsumer.prototype.consume).toHaveBeenCalledWith(socketClient);
                });
            });

            describe("with cash out error", () => {
                const error = new Error("Cash out failed");

                beforeEach(() => {
                    settleCashOutConsumer.validateCashOut.mockReturnValue(true);
                    settleCashOutConsumer.proceedCashOut.mockRejectedValue(error);
                });

                it("should throw the original error", async () => {
                    // Act & Assert
                    await expect(consumer.consume(socketClient)).rejects.toThrow(error);
                });

                it("should not call super.consume when cash out fails", async () => {
                    // Act
                    try {
                        await consumer.consume(socketClient);
                    } catch (error) {
                        // Ignore error
                    }

                    // Assert
                    expect(Core.BaseEventConsumers.UserDisconnectConsumer.prototype.consume).not.toHaveBeenCalled();
                });
            });
        });
    });
});
