import { stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { logger } from "sc-common";
import { Actions } from "../../constants";
import GameData from "../../game-data";
import UmInfoWatcher from "../um-info-watcher";

jest.mock("sc-common");

const umInfoRepository = stubMongoose(mongoose.Model);
const gameData = new GameData(0);

// Mock the watch method properly
umInfoRepository.watch = jest.fn();

function initUMWatcher() {
    return new UmInfoWatcher(gameData, umInfoRepository, logger);
}

function createMockChangeStream() {
    return {
        on: jest.fn(),
        resumeToken: "mock-resume-token-123"
    };
}

describe("UmInfoWatcher", () => {
    let watcher;

    beforeEach(() => {
        watcher = initUMWatcher();
        // Reset gameData.ingame for each test
        gameData.ingame = {};
        jest.clearAllMocks();
        // Reset the watch mock
        umInfoRepository.watch.mockClear();
    });

    describe("constructor", () => {
        it("should initialize with correct dependencies", () => {
            expect(watcher.gameData).toBe(gameData);
            expect(watcher.umInfoRepository).toBe(umInfoRepository);
            expect(watcher.logService).toBe(logger);
        });
    });

    describe("initChangeStream", () => {
        beforeEach(() => {
            // Reset the mock before each test
            jest.clearAllMocks();
        });

        it("should create change stream and register events", () => {
            const mockChangeStream = createMockChangeStream();
            umInfoRepository.watch.mockReturnValue(mockChangeStream);
            const pipeline = [];
            const options = {};

            watcher.initChangeStream(pipeline, options);

            expect(umInfoRepository.watch).toHaveBeenCalledWith(pipeline, options);
            expect(watcher.changeStream).toBe(mockChangeStream);
            expect(mockChangeStream.on).toHaveBeenCalledWith("change", expect.any(Function));
            expect(mockChangeStream.on).toHaveBeenCalledWith("close", expect.any(Function));
            expect(mockChangeStream.on).toHaveBeenCalledWith("error", expect.any(Function));
        });

        it("should use default parameters when none provided", () => {
            const mockChangeStream = createMockChangeStream();
            umInfoRepository.watch.mockReturnValue(mockChangeStream);

            watcher.initChangeStream();

            expect(umInfoRepository.watch).toHaveBeenCalledWith([], {});
        });
    });

    describe("registerEvents", () => {
        it("should register all event handlers", () => {
            const mockChangeStream = createMockChangeStream();
            watcher.changeStream = mockChangeStream;

            watcher.registerEvents();

            expect(mockChangeStream.on).toHaveBeenCalledTimes(3);
            expect(mockChangeStream.on).toHaveBeenCalledWith("change", expect.any(Function));
            expect(mockChangeStream.on).toHaveBeenCalledWith("close", expect.any(Function));
            expect(mockChangeStream.on).toHaveBeenCalledWith("error", expect.any(Function));
        });
    });

    describe("handleChangeStreamChange", () => {
        describe("when operationType is insert", () => {
            describe("when partnerId has value", () => {
                it("should set isUm to true for refund players with matching partnerId", () => {
                    const data = {
                        operationType: "insert",
                        fullDocument: {
                            partnerId: "partner1",
                        },
                    };
                    const player1 = {
                        betTracks: {},
                        operatorId: "partner1",
                        isUm: false,
                    };
                    const player2 = {
                        betTracks: {},
                        operatorId: "partner2",
                        isUm: false,
                    };
                    gameData.ingame = {
                        player1,
                        player2,
                    };

                    watcher.handleChangeStreamChange(data);

                    expect(player1.isUm).toBe(true);
                    expect(player2.isUm).toBe(false);
                });
            });

            describe("when partnerId is null", () => {
                it("should set isUm to true for all players", () => {
                    const data = {
                        operationType: "insert",
                        fullDocument: {
                            partnerId: null,
                        },
                    };
                    const player1 = {
                        betTracks: {},
                        operatorId: "partner1",
                        isUm: false,
                    };
                    const player2 = {
                        betTracks: {},
                        operatorId: "partner2",
                        isUm: false,
                    };
                    gameData.ingame = {
                        player1,
                        player2,
                    };

                    watcher.handleChangeStreamChange(data);

                    expect(player1.isUm).toBe(true);
                    expect(player2.isUm).toBe(true);
                });
            });

            it("should not set isUm to true for players who have cashed out", () => {
                const data = {
                    operationType: "insert",
                    fullDocument: {
                        partnerId: "partner1",
                    },
                };
                const player1 = {
                    betTracks: {
                        [Actions.CashOut]: { time: new Date() },
                    },
                    operatorId: "partner1",
                    isUm: false,
                };
                const player2 = {
                    betTracks: {},
                    operatorId: "partner1",
                    isUm: false,
                };
                gameData.ingame = {
                    player1,
                    player2,
                };

                watcher.handleChangeStreamChange(data);

                expect(player1.isUm).toBe(false);
                expect(player2.isUm).toBe(true);
            });

            it("should handle empty gameData.ingame", () => {
                const data = {
                    operationType: "insert",
                    fullDocument: {
                        partnerId: "partner1",
                    },
                };
                gameData.ingame = {};

                expect(() => {
                    watcher.handleChangeStreamChange(data);
                }).not.toThrow();
            });

            it("should handle players without operatorId", () => {
                const data = {
                    operationType: "insert",
                    fullDocument: {
                        partnerId: "partner1",
                    },
                };
                const player1 = {
                    betTracks: {},
                    isUm: false,
                };
                gameData.ingame = {
                    player1,
                };

                watcher.handleChangeStreamChange(data);

                expect(player1.isUm).toBe(false);
            });
        });

        describe("when operationType is not insert", () => {
            it("should not process non-insert operations", () => {
                const data = {
                    operationType: "update",
                    fullDocument: {
                        partnerId: "partner1",
                    },
                };
                const player1 = {
                    betTracks: {},
                    operatorId: "partner1",
                    isUm: false,
                };
                gameData.ingame = {
                    player1,
                };

                watcher.handleChangeStreamChange(data);

                expect(player1.isUm).toBe(false);
            });
        });
    });

    describe("handleChangeStreamError", () => {
        it("should call logger.logError", () => {
            const error = new Error("Test error");

            watcher.handleChangeStreamError(error);

            expect(logger.logError).toHaveBeenCalledWith(error);
        });
    });

    describe("handleChangeStreamClosed", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should restart change stream with resume token after delay", (done) => {
            const mockChangeStream = createMockChangeStream();
            watcher.changeStream = mockChangeStream;
            umInfoRepository.watch.mockReturnValue(mockChangeStream);
            jest.spyOn(watcher, 'initChangeStream').mockImplementation(() => {});

            watcher.handleChangeStreamClosed();

            setTimeout(() => {
                expect(watcher.initChangeStream).toHaveBeenCalledWith([], { 
                    startAfter: "mock-resume-token-123" 
                });
                done();
            }, 1100);
        });

        it("should handle missing resume token", (done) => {
            const mockChangeStream = {
                on: jest.fn(),
                resumeToken: undefined
            };
            watcher.changeStream = mockChangeStream;
            umInfoRepository.watch.mockReturnValue(mockChangeStream);
            jest.spyOn(watcher, 'initChangeStream').mockImplementation(() => {});

            watcher.handleChangeStreamClosed();

            setTimeout(() => {
                expect(watcher.initChangeStream).toHaveBeenCalledWith([], { 
                    startAfter: undefined 
                });
                done();
            }, 1100);
        });
    });
});