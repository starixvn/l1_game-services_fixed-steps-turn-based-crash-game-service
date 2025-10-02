import Chance from "chance";
import RoundResultPublisher from "../round-result-publisher";

const chance = new Chance();

describe("RoundResultPublisher", () => {
    /**
     * @type {RoundResultPublisher}
     */
    let publisher;

    beforeEach(() => {
        publisher = new RoundResultPublisher();
        publisher.publishToUser = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("publishRoundResult", () => {
        it("should call publishToUser with correct parameters", () => {
            // Arrange
            const roundResult = {
                playerId: chance.guid(),
                result: chance.floating({ min: 1, max: 10 }),
            };

            // Act
            publisher.publishRoundResult(roundResult);

            // Assert
            expect(publisher.publishToUser).toHaveBeenCalledWith(roundResult.playerId, {
                finish: roundResult.result,
            });
        });

        it("should handle roundResult with additional properties", () => {
            // Arrange
            const roundResult = {
                playerId: chance.guid(),
                result: chance.floating({ min: 1, max: 10 }),
                roundId: chance.natural(),
                timestamp: new Date(),
            };

            // Act
            publisher.publishRoundResult(roundResult);

            // Assert
            expect(publisher.publishToUser).toHaveBeenCalledWith(roundResult.playerId, {
                finish: roundResult.result,
            });
        });

    });

    describe("publishProvablyFair", () => {
        it("should call publishToUser with serverSeedHash when clientSeed is not provided", () => {
            // Arrange
            const playerId = chance.guid();
            const provablyFair = {
                serverSeedHash: chance.hash(),
            };

            // Act
            publisher.publishProvablyFair(playerId, provablyFair);

            // Assert
            expect(publisher.publishToUser).toHaveBeenCalledWith(playerId, {
                resultHash: { hashValue: provablyFair.serverSeedHash },
            });
        });

        it("should call publishToUser with serverSeedHash and clientSeed when clientSeed is provided", () => {
            // Arrange
            const playerId = chance.guid();
            const provablyFair = {
                serverSeedHash: chance.hash(),
                clientSeed: chance.string({ length: 10 }),
            };

            // Act
            publisher.publishProvablyFair(playerId, provablyFair);

            // Assert
            expect(publisher.publishToUser).toHaveBeenCalledWith(playerId, {
                resultHash: { hashValue: provablyFair.serverSeedHash },
                clientSeed: provablyFair.clientSeed,
            });
        });

        it("should handle provablyFair with empty clientSeed", () => {
            // Arrange
            const playerId = chance.guid();
            const provablyFair = {
                serverSeedHash: chance.hash(),
                clientSeed: "",
            };

            // Act
            publisher.publishProvablyFair(playerId, provablyFair);

            // Assert
            expect(publisher.publishToUser).toHaveBeenCalledWith(playerId, {
                resultHash: { hashValue: provablyFair.serverSeedHash },
            });
        });

        it("should handle provablyFair with null clientSeed", () => {
            // Arrange
            const playerId = chance.guid();
            const provablyFair = {
                serverSeedHash: chance.hash(),
                clientSeed: null,
            };

            // Act
            publisher.publishProvablyFair(playerId, provablyFair);

            // Assert
            expect(publisher.publishToUser).toHaveBeenCalledWith(playerId, {
                resultHash: { hashValue: provablyFair.serverSeedHash },
            });
        });

        it("should handle provablyFair with undefined clientSeed", () => {
            // Arrange
            const playerId = chance.guid();
            const provablyFair = {
                serverSeedHash: chance.hash(),
                clientSeed: undefined,
            };

            // Act
            publisher.publishProvablyFair(playerId, provablyFair);

            // Assert
            expect(publisher.publishToUser).toHaveBeenCalledWith(playerId, {
                resultHash: { hashValue: provablyFair.serverSeedHash },
            });
        });

        it("should handle provablyFair with additional properties", () => {
            // Arrange
            const playerId = chance.guid();
            const provablyFair = {
                serverSeedHash: chance.hash(),
                clientSeed: chance.string({ length: 10 }),
                serverSeed: chance.string({ length: 20 }),
                nonce: chance.natural(),
            };

            // Act
            publisher.publishProvablyFair(playerId, provablyFair);

            // Assert
            expect(publisher.publishToUser).toHaveBeenCalledWith(playerId, {
                resultHash: { hashValue: provablyFair.serverSeedHash },
                clientSeed: provablyFair.clientSeed,
            });
        });

    });

});
