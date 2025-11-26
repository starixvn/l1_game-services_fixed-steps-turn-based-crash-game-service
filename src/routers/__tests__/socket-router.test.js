import { BaseSocketRouter } from "sc-game-base/src/core/routers";
import { Socket } from "socket.io-client";
import { SocketRouter } from "../";
import { CashOutConsumer } from "../../consumers";

describe("SocketRouter", () => {
    /** @type {Socket} */
    const socketClient = {
        on: jest.fn(),
        emit: jest.fn(),
        id: 99999,
    };

    const mockDefinition = { name: "testGame", historyPageSize: 10 };
    const mockLogService = { logError: jest.fn() };

    /** @type {CashOutConsumer} */
    const cashOutConsumer = { consume: jest.fn() };

    /** @type {GameResultServiceConsumer} */
    const gameResultServiceConsumer = { getUrl: jest.fn() };

    /** @type {HistoryQuery} */
    const historyQuery = { queryProvablyFair: jest.fn(), queryHistory: jest.fn() };

    /** @type {SocketRouter} */
    let socketRouter;

    beforeEach(() => {
        socketRouter = new SocketRouter({
            definition: mockDefinition,
            cashOutConsumer,
            gameResultServiceConsumer,
            historyQuery,
            logService: mockLogService,
        });
        socketRouter.socketClient = socketClient;
        socketRouter.verify = jest.fn().mockReturnValue(true);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should inherit BaseSocketRouter", () => {
        expect(socketRouter instanceof BaseSocketRouter);
    });

    describe("init", () => {
        it("should register all event handlers", () => {
            // Act
            socketRouter.init(socketClient);

            // Assert
            expect(socketClient.on).toHaveBeenCalledWith("cashOut", expect.any(Function));
            expect(socketClient.on).toHaveBeenCalledWith("betDetails", expect.any(Function));
            expect(socketClient.on).toHaveBeenCalledWith("getProvablyFair", expect.any(Function));
        });
    });

    describe("handleCashOut", () => {
        const payload = { amount: 123 };

        it("should call cashOutConsumer when verification passes", () => {
            // Arrange
            const mockPlayer = { id: "player1" };
            socketRouter.gameData = {
                realPlayers: {
                    [socketClient.id]: mockPlayer,
                },
            };

            // Act
            socketRouter.handleCashOut(payload);

            // Assert
            expect(cashOutConsumer.consume).toHaveBeenCalledWith(mockPlayer, payload);
        });

        it("should not call cashOutConsumer when verification fails", () => {
            // Arrange
            socketRouter.verify.mockReturnValueOnce(false);

            // Act
            socketRouter.handleCashOut(payload);

            // Assert
            expect(cashOutConsumer.consume).not.toHaveBeenCalled();
        });

        it("should log error when exception occurs", () => {
            // Arrange
            const error = new Error("Test error");
            cashOutConsumer.consume.mockImplementationOnce(() => {
                throw error;
            });
            socketRouter.gameData = {
                realPlayers: {
                    [socketClient.id]: { session: "test-session" },
                },
            };
            // Act
            socketRouter.handleCashOut(payload);

            // Assert
            expect(mockLogService.logError).toHaveBeenCalledWith(error);
        });
    });

    describe("handleBetDetails", () => {
        const payload = {
            mode: "test",
            timeZoneOffset: -120,
            roundId: "123",
            language: "en",
        };

        const mockSession = {
            playerId: "player1",
            operatorId: "operator1",
            siteId: "site1",
        };

        beforeEach(() => {
            socketRouter.gameData = {
                realPlayers: {
                    [socketClient.id]: { session: mockSession },
                },
            };
        });

        it("should emit bet details URL when authentication succeeds", async () => {
            // Arrange
            const mockResult = {
                isAuthenticated: true,
                redirectUrl: "http://example.com",
            };
            gameResultServiceConsumer.getUrl.mockResolvedValueOnce(mockResult);

            // Act
            await socketRouter.handleBetDetails(payload);

            // Assert
            expect(gameResultServiceConsumer.getUrl).toHaveBeenCalledWith({
                ...mockSession,
                ...payload,
            });
            expect(socketClient.emit).toHaveBeenCalledWith(mockDefinition.name, { betDetailsUrl: mockResult.redirectUrl });
        });

        it("should not emit when authentication fails", async () => {
            // Arrange
            gameResultServiceConsumer.getUrl.mockResolvedValueOnce({ isAuthenticated: false });

            // Act
            await socketRouter.handleBetDetails(payload);

            // Assert
            expect(socketClient.emit).not.toHaveBeenCalled();
        });
    });

    describe("getProvablyFair", () => {
        const payload = { roundId: "123" };

        it("should emit provably fair data when verification passes", async () => {
            // Arrange
            const mockPlayer = { id: "player1" };
            const mockProvablyFair = { seed: "test-seed" };
            socketRouter.gameData = {
                realPlayers: {
                    [socketClient.id]: mockPlayer,
                },
            };
            historyQuery.queryProvablyFair.mockResolvedValueOnce(mockProvablyFair);

            // Act
            await socketRouter.getProvablyFair(payload);

            // Assert
            expect(historyQuery.queryProvablyFair).toHaveBeenCalledWith(mockPlayer, payload.roundId);
            expect(socketClient.emit).toHaveBeenCalledWith(mockDefinition.name, mockProvablyFair);
        });

        it("should not emit when verification fails", async () => {
            // Arrange
            socketRouter.verify.mockReturnValueOnce(false);

            // Act
            await socketRouter.getProvablyFair(payload);

            // Assert
            expect(historyQuery.queryProvablyFair).not.toHaveBeenCalled();
            expect(socketClient.emit).not.toHaveBeenCalled();
        });

        it("should log error when exception occurs", async () => {
            // Arrange
            const error = new Error("Test error");
            historyQuery.queryProvablyFair.mockRejectedValueOnce(error);
            socketRouter.gameData = {
                realPlayers: {
                    [socketClient.id]: { session: "test-session" },
                },
            };

            // Act
            await socketRouter.getProvablyFair(payload);

            // Assert
            expect(mockLogService.logError).toHaveBeenCalledWith(error);
        });
    });

    describe("handleGetHistory", () => {
        const payload = { page: 1, pageSize: 20 };
        const history = { history: [{ id: 1 }, { id: 2 }] };

        beforeEach(() => {
            socketRouter.verify = jest.fn();
            socketRouter.gameData = {
                realPlayers: {
                    [socketClient.id]: socketClient,
                },
            };
            historyQuery.queryHistory.mockResolvedValueOnce(history);
        });

        it("should call verify", async () => {
            // Act
            await socketRouter.handleGetHistory(payload);

            // Assert
            expect(socketRouter.verify).toHaveBeenCalled();
        });

        describe("when event is valid", () => {
            beforeEach(() => {
                socketRouter.verify.mockReturnValueOnce(true);
            });

            it("should query history with correct parameters", async () => {
                // Act
                await socketRouter.handleGetHistory(payload);

                // Assert
                expect(historyQuery.queryHistory).toHaveBeenCalledWith(
                    socketClient,
                    payload.page,
                    payload.pageSize
                );
            });

            it("should use default page size when not provided", async () => {
                // Arrange
                const payloadWithoutPageSize = { page: 1 };

                // Act
                await socketRouter.handleGetHistory(payloadWithoutPageSize);

                // Assert
                expect(historyQuery.queryHistory).toHaveBeenCalledWith(
                    socketClient,
                    payloadWithoutPageSize.page,
                    mockDefinition.historyPageSize
                );
            });

            it("should emit history with default response key", async () => {
                // Act
                await socketRouter.handleGetHistory(payload);

                // Assert
                expect(socketClient.emit).toHaveBeenCalledWith(
                    mockDefinition.name,
                    { history: history.history }
                );
            });

            it("should emit history with custom response key", async () => {
                // Arrange
                const payloadWithCustomKey = { ...payload, responseKey: "customKey" };

                // Act
                await socketRouter.handleGetHistory(payloadWithCustomKey);

                // Assert
                expect(socketClient.emit).toHaveBeenCalledWith(
                    mockDefinition.name,
                    { customKey: history.history }
                );
            });

        });

        describe("when event is invalid", () => {
            beforeEach(() => {
                socketRouter.verify.mockReturnValueOnce(false);
            });

            it("should not query history", async () => {
                // Act
                await socketRouter.handleGetHistory(payload);

                // Assert
                expect(historyQuery.queryHistory).not.toHaveBeenCalled();
            });

            it("should not emit history", async () => {
                // Act
                await socketRouter.handleGetHistory(payload);

                // Assert
                expect(socketClient.emit).not.toHaveBeenCalled();
            });
        });
    });
});
