import PlaceBetPublisher from "../place-bet-publisher";
import Chance from "chance";

const chance = new Chance();

describe("placeBetPublisher", () => {
    let publisher;

    beforeEach(() => {
        publisher = new PlaceBetPublisher();

        publisher.publishToUser = jest.fn();
        publisher.publishToAllUsersExcept = jest.fn();
    });

    describe("publishSuccessCashOut", () => {
        const playerId = chance.guid();
        const payload = {
            win: chance.natural(),
        };
        const rate = chance.floating({ min: 1 });

        it("should call publishToUser", () => {
            // Act
            publisher.publishSuccessCashOut(playerId, payload, rate);

            // Assert
            expect(publisher.publishToUser).toBeCalledWith(playerId, payload);
        });

        it("should call publishToAllUsersExcept", () => {
            // Act
            publisher.publishSuccessCashOut(playerId, payload, rate);

            // Assert
            expect(publisher.publishToAllUsersExcept).toBeCalledWith(playerId, { otherPlayer: { ...payload, rate } });
        });
    });
});
