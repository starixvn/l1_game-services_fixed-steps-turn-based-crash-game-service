import { Core } from "sc-game-base";
import LiveGamePublisher from "../live-game-publisher";
import { Chance } from "chance";

const chance = new Chance();

describe.skip("liveGamePublisher", () => {
    const publisher = new LiveGamePublisher();

    beforeEach(() => {
        publisher.publishToAllUsers = jest.fn();
    });

    it("inherit Core.BaseEventPublishers.BaseEventPublisher", () => {
        // Assert
        expect(publisher instanceof Core.BaseEventPublishers.BaseEventPublisher);
    });

    describe("publish", () => {
        it("should call publish to all user", () => {
            // Arrange
            const multiplier = chance.floating();
            const liveTime = chance.natural();

            // Act
            publisher.publish(multiplier, liveTime);

            // Assert
            expect(publisher.publishToAllUsers).toBeCalledWith({ c: { m: multiplier, t: liveTime } });
        });
    });
});
