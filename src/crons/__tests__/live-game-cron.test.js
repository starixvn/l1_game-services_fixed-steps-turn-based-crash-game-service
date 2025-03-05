import { Chance } from "chance";
import { stub } from "jest-micro-auto-stub";
import LiveGamePublisher from "../../event-publishers/live-game-publisher";
import CrashGameData from "../../game-data";
import { calculateMultiplier } from "../../helpers/crash-point-helper";
import LiveGameCrons from "../live-game-cron";

jest.mock("../../helpers/crash-point-helper", () => ({
    calculateMultiplier: jest.fn(),
    calculateCrashTimeInMillisecond: jest.fn(),
}));

const liveGameLogsRepository = {
    create: jest.fn(),
};

const settleCashOutConsumer = {
    proceedAutoCashOut: jest.fn(),
};

describe("liveGameCrons", () => {
    const gameData = new CrashGameData();
    gameData.startTime = new Date();
    const liveGamePublisher = stub(LiveGamePublisher);
    const logService = {};
    const chance = new Chance();
    let cron;

    beforeEach(() => {
        cron = new LiveGameCrons({ liveGamePublisher, logService, gameData, liveGameLogsRepository, settleCashOutConsumer });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("proceed", () => {
        const mockDate = new Date();
        beforeEach(() => {
            cron.proceedAutoCashOut = jest.fn();
            jest.spyOn(global, "Date").mockImplementation(() => mockDate);
        });

        it("should call calculate multiplier", () => {
            // Act
            cron.proceed();

            // Assert
            expect(calculateMultiplier).toBeCalledWith(mockDate - gameData.startTime);
        });

        it("should call liveGamePublisher.publish", () => {
            // Act
            cron.proceed();

            // Assert
            expect(calculateMultiplier).toBeCalledWith(mockDate - gameData.startTime);
        });

        it("should call proceedAutoCashOut", () => {
            // Arrange
            const m = chance.floating({ min: 1, max: 2000 });
            calculateMultiplier.mockReturnValueOnce(m);

            // Act
            cron.proceed();

            // Assert
            expect(cron.settleCashOutConsumer.proceedAutoCashOut).toBeCalledWith(m);
        });
    });

    describe("stop", () => {
        it("should remove timeOut", () => {
            // Arrange
            jest.spyOn(global, "clearTimeout");
            cron.timeoutId = chance.natural();

            // Act
            cron.stop();

            // Assert
            expect(clearTimeout).toBeCalledWith(cron.timeoutId);
        });
    });

    describe("start", () => {
        beforeEach(() => {
            cron.proceed = jest.fn();
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
            cron.timeoutId && clearTimeout(cron.timeoutId);
        });

        it("should call proceed every 100ms", () => {
            // Act
            cron.start();
            jest.advanceTimersByTime(1000);

            // Assert
            expect(cron.proceed).toHaveBeenCalledTimes(11);
        });

        it("should call proceed", () => {
            // Act
            cron.start();

            // Assert
            expect(cron.proceed).toBeCalled();
        });

        it("should call setTimeOut", () => {
            // Act
            jest.spyOn(global, "setTimeout");
            cron.start();

            // Assert
            expect(setTimeout).toBeCalledWith(expect.any(Function), 100);
        });
    });
});
