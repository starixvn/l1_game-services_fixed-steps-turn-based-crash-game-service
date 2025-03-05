import { TableHttpRouter } from "sc-game-base/src/table/routers";
import HttpRouter from "../http-router";

jest.mock("sc-common");

describe("httpRouter", () => {
    const app = { post: jest.fn(), get: jest.fn() };
    const logService = { logError: jest.fn(), logWarning: jest.fn() };
    const appConfigs = {
        apiSettings: {
            authUrl: "http://localhost",
        },
        authenticateSettings: {
            audiences: [],
        },
    };
    let router;

    beforeEach(() => {
        router = new HttpRouter(appConfigs, {}, {}, {}, logService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("inherit TableHttpRouter", () => {
        expect(router instanceof TableHttpRouter);
    });

    describe("init", () => {
        it("should register post api/set-result route", () => {
            // Act
            router.init(app);

            // Assert
            expect(app.post).toHaveBeenLastCalledWith("/api/set-result", undefined, expect.any(Function));
        });
    });

    describe("handleSetBoard", () => {
        const res = { send: jest.fn() };

        describe("when param is NOT valid", () => {
            it("should call logService.logError", () => {
                // Act
                router.handleSetBoard({}, res);

                // Assert
                expect(logService.logError).toBeCalledWith("receives a result cheating call with invalid params.");
            });

            it("should response false", () => {
                // Act
                router.handleSetBoard(undefined, res);

                // Assert
                expect(res.send).toBeCalledWith(false);
            });
        });

        describe("when param is valid", () => {
            const params = { result: 1, roundId: 1 };

            it("should call logService.logWarning", () => {
                // Act
                router.handleSetBoard(params, res);

                // Assert
                expect(logService.logWarning).toBeCalledWith(
                    `receives a result cheating call for ${params?.name} with the board as ${params.result}.`
                );
            });

            it("should set settlementResultFromAdmin in gameData", () => {
                // Act
                router.handleSetBoard(params, res);

                // Assert
                expect(router.gameData.settlementResultFromAdmin).toStrictEqual({
                    result: params.result,
                    roundId: params.roundId,
                });
            });

            it("should response true", () => {
                // Act
                router.handleSetBoard(params, res);

                // Assert
                expect(res.send).toBeCalledWith(true);
            });
        });
    });
});
