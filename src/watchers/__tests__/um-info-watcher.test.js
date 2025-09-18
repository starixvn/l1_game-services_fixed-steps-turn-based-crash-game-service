import { stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { logger } from "sc-common";
import { Actions } from "../../constants";
import GameData from "../../game-data";
import UmInfoWatcher from "../um-info-watcher";

jest.mock("sc-common");

const umInfoRepository = stubMongoose(mongoose.Model);
const gameData = new GameData(0);
function initUMWatcher() {
    return new UmInfoWatcher(gameData, umInfoRepository, logger);
}

describe.skip("handleChangeStreamChange", () => {
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
            const watcher = initUMWatcher();

            watcher.handleChangeStreamChange(data);

            expect(player1.isUm).toBe(true);
            expect(player2.isUm).toBe(false);
        });
    });

    describe("when partnerId is null", () => {
        it("should set isUm to true for all players ", () => {
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
            const watcher = initUMWatcher();

            watcher.handleChangeStreamChange(data);

            expect(player1.isUm).toBe(true);
            expect(player2.isUm).toBe(true);
        });
    });

    it("should not set isUm to true for players cashout", () => {
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
        const watcher = initUMWatcher();

        watcher.handleChangeStreamChange(data);

        expect(player1.isUm).toBe(false);
        expect(player2.isUm).toBe(true);
    });
});

describe("handleChangeStreamError", () => {
    it("should call logger.logError", () => {
        const watcher = initUMWatcher();
        const error = new Error("error");

        watcher.handleChangeStreamError(error);
        expect(logger.logError).toHaveBeenCalledWith(error);
    });
});
