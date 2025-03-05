import { GameClientDriver, normalUser } from "sc-game-service-integration-utils";
import { initUserSession } from "./helpers";
import { socketOptions } from "./stubs/test-data";

describe("ProvablyPair", () => {
    let userClientDriver;

    afterAll(() => {
        userClientDriver.close();
    });

    beforeAll(async () => {
        userClientDriver = new GameClientDriver(socketOptions, initUserSession(normalUser));
        await userClientDriver.handleSignedInEvent();
        userClientDriver.sendInGameEvent();
    });

    describe("when start placeBet", () => {
        it("should receive pf server seed hash ", async () => {
            //Act
            const { pf } = await userClientDriver.handleGameEvent((data) => data.pf);

            // Assert
            expect(pf.roundId).toBeDefined();
            expect(pf.serverSeedHash).toBeDefined();
        });
    });

    describe("when finish", () => {
        it("should receive pf info", async () => {
            //Act
            const { finish } = await userClientDriver.handleGameEvent((data) => data.finish);

            // Assert
            expect(finish.pf.finalHash).toBeDefined();
            expect(finish.pf.mergeSeed).toBeDefined();
            expect(finish.pf.result).toBeDefined();
            expect(finish.pf.roundId).toBeDefined();
            expect(finish.pf.clientSeeds).toBeDefined();
        });
    });
});
