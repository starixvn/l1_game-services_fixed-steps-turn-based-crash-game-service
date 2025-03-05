import { GameClientDriver, normalUser } from "sc-game-service-integration-utils";
import { initUserSession } from "./helpers";
import { socketOptions } from "./stubs/test-data";

describe("cashOut", () => {
    let userClientDriver;

    afterAll(() => {
        userClientDriver.close();
    });

    beforeAll(async () => {
        userClientDriver = new GameClientDriver(socketOptions, initUserSession(normalUser));
        await userClientDriver.handleSignedInEvent();
        userClientDriver.sendInGameEvent();
    });

    describe("when cashOut", () => {
        it("should cash out successful", async () => {
            const betAmount = 1;
            await userClientDriver.handleGameEvent((data) => data.spb);
            await new Promise((r) => setTimeout(r, 1000));
            userClientDriver.emit("bet", {
                amount: betAmount,
                clientSeed: "1234",
                clientSendTime: new Date(),
                username: normalUser.playerName,
            });

            await userClientDriver.handleGameEvent((data) => data.endBet);
            await userClientDriver.handleGameEvent((data) => data.c?.m > 1);
            userClientDriver.emit("cashOut", { clientSendTime: new Date(), halfCashOut: true });
            const { halfCashOut } = await userClientDriver.handleGameEvent((data) => data.halfCashOut);
            userClientDriver.emit("cashOut", { clientSendTime: new Date() });
            const { cashOut } = await userClientDriver.handleGameEvent((data) => data.cashOut);
            const { status } = await userClientDriver.handleGameEvent((data) => data.status);

            expect(halfCashOut.amount).toBe(betAmount / 2);
            expect(cashOut.amount).toBe(betAmount / 2);
            expect(status.bet).toBe(halfCashOut.win + cashOut.win);
        }, 60_000);
    });

    describe("when autoCashOut", () => {
        it("should cash out successful", async () => {
            const betAmount = 1;
            const autoCashOut = 1.1;
            await userClientDriver.handleGameEvent((data) => data.spb);
            await new Promise((r) => setTimeout(r, 1000));
            userClientDriver.emit("bet", {
                amount: betAmount,
                clientSeed: "1234",
                clientSendTime: new Date(),
                username: normalUser.playerName,
                autoCashOut,
            });

            await userClientDriver.handleGameEvent((data) => data.endBet);
            await userClientDriver.handleGameEvent((data) => data.c?.m > 1);
            const { cashOut } = await userClientDriver.handleGameEvent((data) => data.cashOut);
            const { status } = await userClientDriver.handleGameEvent((data) => data.status);

            expect(cashOut.amount).toBe(betAmount);
            expect(cashOut.win).toBe(betAmount * autoCashOut);
            expect(status.bet).toBe(betAmount * autoCashOut);
        }, 60_000);
    });
});
