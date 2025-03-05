import { GameClientDriver, normalUser } from "sc-game-service-integration-utils";
import { initUserSession } from "./helpers";
import { socketOptions } from "./stubs/test-data";

describe("refund bet", () => {
    let userClientDriver;

    afterAll(() => {
        userClientDriver.close();
    });

    beforeAll(async () => {
        userClientDriver = new GameClientDriver(socketOptions, initUserSession(normalUser));
        await userClientDriver.handleSignedInEvent();
        userClientDriver.sendInGameEvent();
    });
    it("should refund all unsettled bets", async () => {
        // Act
        await new Promise((r) => setTimeout(r, 8000));
        userClientDriver.sendGetHistoryEvent(1);
        const result = await userClientDriver.handleGameEvent((betHistoryData) => betHistoryData.history);
        // Assert
        expect(result).toBeDefined();
    });
});
