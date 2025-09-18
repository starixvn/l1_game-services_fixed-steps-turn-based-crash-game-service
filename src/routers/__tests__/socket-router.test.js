import { BaseSocketRouter } from "sc-game-base/src/core/routers";
import { SocketRouter } from "../";

describe.skip("socketRouter", () => {
    const socketClient = { on: jest.fn(), id: 99999 };
    const cashOutConsumer = { consume: jest.fn() };
    let socketRouter;
    beforeEach(() => {
        socketRouter = new SocketRouter({ cashOutConsumer });
        socketRouter.socketClient = socketClient;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should inherit BaseSocketRouter", () => {
        expect(socketRouter instanceof BaseSocketRouter);
    });

    describe("init", () => {
        it("should register cashOut event", () => {
            // Act
            socketRouter.init(socketClient);

            // Assert
            expect(socketClient.on).toHaveBeenLastCalledWith("cashOut", expect.any(Function));
        });
    });

    describe("handleCashOut", () => {
        const payload = { amount: 123 };

        beforeEach(() => {
            socketRouter.verify = jest.fn();
        });

        it("should call verify", () => {
            // Act
            socketRouter.handleCashOut(payload);

            // Assert
            expect(socketRouter.verify).toBeCalled();
        });

        describe("when event is valid", () => {
            const gameData = {
                realPlayers: {
                    [socketClient.id]: socketClient,
                },
            };

            beforeEach(() => {
                socketRouter.gameData = gameData;
                socketRouter.verify.mockReturnValueOnce(true);
            });

            it("should call cashOutConsumer.consume", () => {
                // Act
                socketRouter.handleCashOut(payload);

                // Assert
                expect(cashOutConsumer.consume).toBeCalledWith(socketClient, payload);
            });
        });
    });
});
