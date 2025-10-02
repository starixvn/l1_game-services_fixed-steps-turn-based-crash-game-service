import { SeedHelper, ServerSeedHelper } from "sc-game-base/src/core/helpers";
import { encrypt } from "../../helpers/crypto-helper";
import { roundFloat } from "../../helpers/number-helper";
import { ProvablyFairConsumer } from "../provably-fair-consumer";

jest.mock("sc-game-base/src/core/helpers");
jest.mock("../../helpers/crypto-helper");
jest.mock("../../helpers/number-helper");

describe("ProvablyFairConsumer", () => {
    /** @type {ProvablyFairConsumer}*/
    let consumer;
    let mockGameData;
    let mockDefinition;
    let mockRoundResultPublisher;
    let mockResultsRepository;

    beforeEach(() => {
        mockGameData = {
            provablyFair: {},
            gameConfigs: {
                randomMode: "secure"
            },
            settlementResultFromAdmin: {}
        };
        mockDefinition = {
            generateResult: jest.fn()
        };
        mockRoundResultPublisher = {
            publishProvablyFair: jest.fn()
        };
        mockResultsRepository = {
            findOne: jest.fn().mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    exec: jest.fn()
                })
            }),
            create: jest.fn()
        };

        consumer = new ProvablyFairConsumer(
            mockGameData,
            mockDefinition,
            mockRoundResultPublisher,
            mockResultsRepository
        );

        // Reset mocks
        jest.clearAllMocks();
    });

    describe("constructor", () => {
        it("should initialize all dependencies correctly", () => {
            expect(consumer.gameData).toBe(mockGameData);
            expect(consumer.definition).toBe(mockDefinition);
            expect(consumer.roundResultPublisher).toBe(mockRoundResultPublisher);
            expect(consumer.resultsRepository).toBe(mockResultsRepository);
            expect(mockGameData.provablyFair).toEqual({});
        });
    });

    describe("generateServerSeedAndPublishHash", () => {
        it("should generate new server seed and hash for new player", () => {
            // Arrange
            const playerId = "player-123";
            const playerName = "testPlayer";
            const mockServerSeed = "server-seed-123";
            const mockServerSeedHash = "hash-123";
            
            ServerSeedHelper.generateServerSeed.mockReturnValue(mockServerSeed);
            SeedHelper.getSHA256Hash.mockReturnValue(mockServerSeedHash);

            // Act
            consumer.generateServerSeedAndPublishHash(playerId, playerName);

            // Assert
            expect(ServerSeedHelper.generateServerSeed).toHaveBeenCalledWith("secure");
            expect(SeedHelper.getSHA256Hash).toHaveBeenCalledWith(mockServerSeed);
            expect(mockGameData.provablyFair[playerName]).toEqual({
                serverSeed: mockServerSeed,
                serverSeedHash: mockServerSeedHash
            });
            expect(mockRoundResultPublisher.publishProvablyFair).toHaveBeenCalledWith(playerId, {
                serverSeed: mockServerSeed,
                serverSeedHash: mockServerSeedHash
            });
        });

        it("should use existing provably fair data for returning player", () => {
            // Arrange
            const playerId = "player-123";
            const playerName = "testPlayer";
            const existingData = { serverSeed: "existing-seed", serverSeedHash: "existing-hash" };
            mockGameData.provablyFair[playerName] = existingData;
 
            // Act
            consumer.generateServerSeedAndPublishHash(playerId, playerName);

            // Assert
            expect(ServerSeedHelper.generateServerSeed).not.toHaveBeenCalled();
            expect(SeedHelper.getSHA256Hash).not.toHaveBeenCalled();
            expect(mockRoundResultPublisher.publishProvablyFair).toHaveBeenCalledWith(playerId, existingData);
        });

        it("should publish provably fair data to player", () => {
            // Arrange
            const playerId = "player-456";
            const playerName = "testPlayer";
            const mockServerSeed = "server-seed-456";
            const mockServerSeedHash = "hash-456";
            
            ServerSeedHelper.generateServerSeed.mockReturnValue(mockServerSeed);
            SeedHelper.getSHA256Hash.mockReturnValue(mockServerSeedHash);

            // Act
            consumer.generateServerSeedAndPublishHash(playerId, playerName);

            // Assert
            expect(mockRoundResultPublisher.publishProvablyFair).toHaveBeenCalledWith(playerId, {
                serverSeed: mockServerSeed,
                serverSeedHash: mockServerSeedHash
            });
        });

    });

    describe("generateCrashPoint", () => {
        beforeEach(() => {
            mockGameData.provablyFair.testPlayer = {
                serverSeed: "server-seed-123"
            };
        });

        it("should generate crash point with valid client seed", () => {
            // Arrange
            const playerName = "testPlayer";
            const clientSeed = "12345";
            const roundId = "round-123";
            const mockFinalHash = "final-hash-123";
            const mockGeneratedResult = 2.5;
            const mockFinalResult = 2.5;
            
            jest.spyOn(consumer, "validateClientSeed").mockReturnValue(true);
            SeedHelper.getSHA512Hash.mockReturnValue(mockFinalHash);
            mockDefinition.generateResult.mockReturnValue(mockGeneratedResult);
            jest.spyOn(consumer, "getResultFromAdmin").mockReturnValue(mockFinalResult);

            // Act
            const result = consumer.generateCrashPoint(playerName, clientSeed, roundId);

            // Assert
            expect(consumer.validateClientSeed).toHaveBeenCalledWith(clientSeed);
            expect(SeedHelper.getSHA512Hash).toHaveBeenCalledWith("server-seed-123" + clientSeed);
            expect(mockDefinition.generateResult).toHaveBeenCalledWith(mockFinalHash);
            expect(consumer.getResultFromAdmin).toHaveBeenCalledWith(playerName, mockGeneratedResult);
            expect(result).toBe(mockFinalResult);
            expect(mockGameData.provablyFair[playerName]).toEqual({
                serverSeed: "server-seed-123",
                clientSeed: clientSeed,
                finalHash: mockFinalHash,
                finalResult: mockFinalResult,
                roundId: roundId
            });
        });

        it("should use default client seed when invalid", () => {
            // Arrange
            const playerName = "testPlayer";
            const clientSeed = "invalid";
            const roundId = "round-123";
            const mockFinalHash = "final-hash-123";
            const mockGeneratedResult = 2.5;
            const mockFinalResult = 2.5;
            
            jest.spyOn(consumer, "validateClientSeed").mockReturnValue(false);
            SeedHelper.getSHA512Hash.mockReturnValue(mockFinalHash);
            mockDefinition.generateResult.mockReturnValue(mockGeneratedResult);
            jest.spyOn(consumer, "getResultFromAdmin").mockReturnValue(mockFinalResult);

            // Act
            const result = consumer.generateCrashPoint(playerName, clientSeed, roundId);

            // Assert
            expect(mockGameData.provablyFair[playerName].clientSeed).toBe(0);
            expect(result).toBe(mockFinalResult);
        });

        it("should handle missing provably fair data", () => {
            // Arrange
            const playerName = "nonExistentPlayer";
            const clientSeed = "12345";
            const roundId = "round-123";
            
            jest.spyOn(consumer, "validateClientSeed").mockReturnValue(true);
            SeedHelper.getSHA512Hash.mockReturnValue("final-hash");
            mockDefinition.generateResult.mockReturnValue(2.5);
            jest.spyOn(consumer, "getResultFromAdmin").mockReturnValue(2.5);

            // Act
            const result = consumer.generateCrashPoint(playerName, clientSeed, roundId);

            // Assert
            expect(result).toBe(2.5);
            expect(mockGameData.provablyFair[playerName]).toBeDefined();
        });

        it("should call definition.generateResult with correct hash", () => {
            // Arrange
            const playerName = "testPlayer";
            const clientSeed = "12345";
            const roundId = "round-123";
            const mockFinalHash = "final-hash-123";
            
            jest.spyOn(consumer, "validateClientSeed").mockReturnValue(true);
            SeedHelper.getSHA512Hash.mockReturnValue(mockFinalHash);
            mockDefinition.generateResult.mockReturnValue(2.5);
            jest.spyOn(consumer, "getResultFromAdmin").mockReturnValue(2.5);

            // Act
            consumer.generateCrashPoint(playerName, clientSeed, roundId);

            // Assert
            expect(mockDefinition.generateResult).toHaveBeenCalledWith(mockFinalHash);
        });

        it("should call getResultFromAdmin with generated result", () => {
            // Arrange
            const playerName = "testPlayer";
            const clientSeed = "12345";
            const roundId = "round-123";
            const mockGeneratedResult = 3.5;
            
            jest.spyOn(consumer, "validateClientSeed").mockReturnValue(true);
            SeedHelper.getSHA512Hash.mockReturnValue("final-hash");
            mockDefinition.generateResult.mockReturnValue(mockGeneratedResult);
            jest.spyOn(consumer, "getResultFromAdmin").mockReturnValue(3.5);

            // Act
            consumer.generateCrashPoint(playerName, clientSeed, roundId);

            // Assert
            expect(consumer.getResultFromAdmin).toHaveBeenCalledWith(playerName, mockGeneratedResult);
        });

        it("should store roundId in provably fair data", () => {
            // Arrange
            const playerName = "testPlayer";
            const clientSeed = "12345";
            const roundId = "round-456";
            
            jest.spyOn(consumer, "validateClientSeed").mockReturnValue(true);
            SeedHelper.getSHA512Hash.mockReturnValue("final-hash");
            mockDefinition.generateResult.mockReturnValue(2.5);
            jest.spyOn(consumer, "getResultFromAdmin").mockReturnValue(2.5);

            // Act
            consumer.generateCrashPoint(playerName, clientSeed, roundId);

            // Assert
            expect(mockGameData.provablyFair[playerName].roundId).toBe(roundId);
        });

    });

    describe("getResultFromAdmin", () => {
        it("should return admin result when available", () => {
            // Arrange
            const playerName = "testPlayer";
            const adminResult = 3.5;
            const generatedResult = 2.5;
            mockGameData.settlementResultFromAdmin[playerName] = adminResult;
            roundFloat.mockReturnValue(3.5);

            // Act
            const result = consumer.getResultFromAdmin(playerName, generatedResult);

            // Assert
            expect(result).toBe(3.5);
            expect(mockGameData.settlementResultFromAdmin[playerName]).toBeUndefined();
            expect(roundFloat).toHaveBeenCalledWith(adminResult);
        });

        it("should return generated result when no admin result", () => {
            // Arrange
            const playerName = "testPlayer";
            const generatedResult = 2.5;
            roundFloat.mockReturnValue(2.5);

            // Act
            const result = consumer.getResultFromAdmin(playerName, generatedResult);

            // Assert
            expect(result).toBe(2.5);
            expect(roundFloat).toHaveBeenCalledWith(generatedResult);
        });

        it("should call roundFloat with correct result", () => {
            // Arrange
            const playerName = "testPlayer";
            const generatedResult = 2.5;
            roundFloat.mockReturnValue(2.5);

            // Act
            consumer.getResultFromAdmin(playerName, generatedResult);

            // Assert
            expect(roundFloat).toHaveBeenCalledWith(generatedResult);
        });
    });

    describe("createResultRecord", () => {
        beforeEach(() => {
            mockGameData.provablyFair.testPlayer = {
                serverSeed: "server-seed-123",
                serverSeedHash: "server-hash-123",
                clientSeed: "12345",
                finalResult: 2.5,
                finalHash: "final-hash-123"
            };
        });

        it("should create new result record when none exists", async () => {
            // Arrange
            const playerName = "testPlayer";
            const roundId = "round-123";
            const mockEncryptedData = { iv: "iv123", content: "content123" };
            
            jest.spyOn(consumer, "findResultRecord").mockResolvedValue(null);
            encrypt.mockReturnValue(mockEncryptedData);
            mockResultsRepository.create.mockResolvedValue({});

            // Act
            await consumer.createResultRecord(playerName, roundId);

            // Assert
            expect(consumer.findResultRecord).toHaveBeenCalledWith(roundId);
            expect(mockResultsRepository.create).toHaveBeenCalledWith({
                roundId: roundId,
                serverSeedHash: "server-hash-123",
                clientSeeds: ["12345"],
                mergeClientSeed: "12345",
                encryptedServerSeed: mockEncryptedData,
                encryptedFinalResult: mockEncryptedData,
                encryptedFinalHash: mockEncryptedData,
                time: expect.any(Date)
            });
        });

        it("should not create record when one already exists", async () => {
            // Arrange
            const playerName = "testPlayer";
            const roundId = "round-123";
            const existingRecord = { roundId: "round-123" };
            
            jest.spyOn(consumer, "findResultRecord").mockResolvedValue(existingRecord);

            // Act
            await consumer.createResultRecord(playerName, roundId);

            // Assert
            expect(mockResultsRepository.create).not.toHaveBeenCalled();
        });

        it("should encrypt all sensitive data when creating result record", async () => {
            // Arrange
            const playerName = "testPlayer";
            const roundId = "round-123";
            const mockEncryptedData = { iv: "iv123", content: "content123" };
            
            jest.spyOn(consumer, "findResultRecord").mockResolvedValue(null);
            encrypt.mockReturnValue(mockEncryptedData);
            mockResultsRepository.create.mockResolvedValue({});

            // Act
            await consumer.createResultRecord(playerName, roundId);

            // Assert
            expect(encrypt).toHaveBeenCalledWith("server-seed-123");
            expect(encrypt).toHaveBeenCalledWith("2.5");
            expect(encrypt).toHaveBeenCalledWith("final-hash-123");
        });


      
    });

    describe("findResultRecord", () => {
        it("should query resultsRepository with correct parameters", async () => {
            // Arrange
            const roundId = "round-123";
            const mockRecord = { roundId: "round-123" };
            const mockQuery = {
                lean: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue(mockRecord)
                })
            };
            mockResultsRepository.findOne.mockReturnValue(mockQuery);

            // Act
            const result = await consumer.findResultRecord(roundId);

            // Assert
            expect(mockResultsRepository.findOne).toHaveBeenCalledWith({ roundId: roundId });
            expect(mockQuery.lean).toHaveBeenCalled();
            expect(mockQuery.lean().exec).toHaveBeenCalled();
            expect(result).toBe(mockRecord);
        });

        it("should return found record", async () => {
            // Arrange
            const roundId = "round-123";
            const mockRecord = { roundId: "round-123", data: "test" };
            const mockQuery = {
                lean: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue(mockRecord)
                })
            };
            mockResultsRepository.findOne.mockReturnValue(mockQuery);

            // Act
            const result = await consumer.findResultRecord(roundId);

            // Assert
            expect(result).toBe(mockRecord);
        });

    });

    describe("validateClientSeed", () => {
        it("should return true for valid integer client seed", () => {
            // Arrange
            const validSeeds = ["123", "0", "9999", "1"];

            // Act & Assert
            validSeeds.forEach(seed => {
                expect(consumer.validateClientSeed(seed)).toBe(true);
            });
        });

        it("should return false for invalid client seed", () => {
            // Arrange
            const invalidSeeds = ["abc", ""];

            // Act & Assert
            invalidSeeds.forEach(seed => {
                expect(consumer.validateClientSeed(seed)).toBe(false);
            });
        });

        it("should handle edge cases", () => {
            // Arrange
            const edgeCases = [
                { seed: "0", expected: true },
                { seed: "-1", expected: true },
                { seed: "999999999", expected: true }
            ];

            // Act & Assert
            edgeCases.forEach(({ seed, expected }) => {
                expect(consumer.validateClientSeed(seed)).toBe(expected);
            });
        });

        it("should handle non-string inputs", () => {
            // Arrange
            const nonStringInputs = [null, undefined, {}, []];

            // Act & Assert
            nonStringInputs.forEach(input => {
                expect(consumer.validateClientSeed(input)).toBe(false);
            });
        });
    });

});
