import { Actions } from "../../constants";
import { generateTapResult, getNextMultiplier } from "../../helpers/crash-point-helper";
import noticeHelper from "../../helpers/notice-helper";
import { MineConsumer } from "../mine-consumer";
import { SettleCashOutConsumer } from "../settle-cash-out-consumer";

jest.mock("../../helpers/crash-point-helper");
jest.mock("../../helpers/notice-helper");

describe("MineConsumer", () => {
    /** @type {MineConsumer}*/
    let consumer;
    let mockDefinition;
    let mockGameData;
    let mockPublisher;
    let mockLogService;
    let mockBetLogsRepository;
    let mockRoundResultConsumer;
    /** @type {SettleCashOutConsumer}*/
    let mockSettleCashOutConsumer;

    const mockPlayer = {
        UID: "player-123",
        profile: { name: "testPlayer" },
        session: {
            siteId: "site-456",
            currencyName: "USD",
            currencyCode: "USD",
            multiplier: 1.0,
            operatorId: "op-789",
            playerId: "player-456",
        },
    };

    const mockActiveBet = {
        amount: 100,
        maxWin: 1000,
        roundId: "round-123",
        currentMultiplier: 1.5,
        multiplierMode: 1,
    };

    const mockGameDataIngame = {
        testPlayer: {
            betTracks: {
                [Actions.Bet]: { amount: 100 },
                [Actions.CashOut]: null,
            },
            activeBet: mockActiveBet,
            currentMultiplier: 1.5,
        },
    };

    mockGameData = {
        ingame: mockGameDataIngame,
        provablyFair: {
            testPlayer: {
                finalResult: 2.0,
            },
        },
        gameConfigs: {
            crashConfig: {
                fixedStepsMultiplierConfigs: [
                    {
                        mode: 1,
                        multiplierSteps: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0]
                    },
                    {
                        mode: 2,
                        multiplierSteps: [2.0, 2.2, 2.4, 2.6, 2.8, 3.0, 3.2, 3.4, 3.6, 3.8, 4.0, 4.2, 4.4, 4.6, 4.8, 5.0]
                    }
                ],
            },
        },
        exchangeRates: {
            code: {
                USD: 1.0,
            },
        },
    };

    beforeEach(() => {
        mockDefinition = {};
        mockPublisher = {
            publishMineResult: jest.fn(),
            publishGameFailedBet: jest.fn(),
        };
        mockLogService = {
            logError: jest.fn(),
        };
        mockBetLogsRepository = {
            create: jest.fn(),
        };
        mockRoundResultConsumer = {};
        mockSettleCashOutConsumer = {
            proceedCashOut: jest.fn(),
        };

        // Reset game data to clean state
        mockGameData.ingame = {
            testPlayer: {
                betTracks: {
                    [Actions.Bet]: { amount: 100 },
                    [Actions.CashOut]: null,
                },
                activeBet: { ...mockActiveBet },
                currentMultiplier: 1.5,
            },
        };

        consumer = new MineConsumer(
            mockDefinition,
            mockGameData,
            mockPublisher,
            mockLogService,
            mockBetLogsRepository,
            mockRoundResultConsumer,
            mockSettleCashOutConsumer
        );

        // Reset mocks
        jest.clearAllMocks();
        getNextMultiplier.mockReturnValue(1.6);
        generateTapResult.mockReturnValue(true);
    });

    describe("constructor", () => {
        it("should initialize all dependencies correctly", () => {
            expect(consumer.definition).toBe(mockDefinition);
            expect(consumer.gameData).toBe(mockGameData);
            expect(consumer.publisher).toBe(mockPublisher);
            expect(consumer.logService).toBe(mockLogService);
            expect(consumer.betLogsRepository).toBe(mockBetLogsRepository);
            expect(consumer.roundResultConsumer).toBe(mockRoundResultConsumer);
            expect(consumer.settleCashOutConsumer).toBe(mockSettleCashOutConsumer);
        });
    });

    describe("mine", () => {
        it("should handle successful mine operation", async () => {
            // Arrange
            const payload = { clientSendTime: Date.now() };
            const validateMineSpy = jest.spyOn(consumer, "validateMine").mockResolvedValue({ isValid: true });
            const handleMineSpy = jest.spyOn(consumer, "handleMine").mockResolvedValue();

            // Act
            await consumer.mine(mockPlayer, payload);

            // Assert
            expect(validateMineSpy).toHaveBeenCalledWith(mockPlayer, payload);
            expect(handleMineSpy).toHaveBeenCalledWith(mockPlayer, mockActiveBet, payload);
        });

        it("should handle validation failure", async () => {
            // Arrange
            const payload = { clientSendTime: Date.now() };
            const validationResult = { isValid: false, error: "SB1942" };
            const validateMineSpy = jest.spyOn(consumer, "validateMine").mockResolvedValue(validationResult);
            const publishMineFailedSpy = jest.spyOn(consumer, "publishMineFailed").mockImplementation();

            // Act
            await consumer.mine(mockPlayer, payload);

            // Assert
            expect(validateMineSpy).toHaveBeenCalledWith(mockPlayer, payload);
            expect(publishMineFailedSpy).toHaveBeenCalledWith(mockPlayer, validationResult.error);
        });

        it("should handle errors and publish mine failed", async () => {
            // Arrange
            const payload = { clientSendTime: Date.now() };
            const error = new Error("Test error");
            jest.spyOn(consumer, "validateMine").mockRejectedValue(error);
            const publishMineFailedSpy = jest.spyOn(consumer, "publishMineFailed").mockImplementation();

            // Act
            await consumer.mine(mockPlayer, payload);

            // Assert
            expect(mockLogService.logError).toHaveBeenCalledWith(error);
            expect(publishMineFailedSpy).toHaveBeenCalledWith(mockPlayer, noticeHelper.invalidMine);
        });
    });

    describe("validateMine", () => {
        it("should return invalid when no bet found", async () => {
            // Arrange
            const playerWithoutBet = {
                ...mockPlayer,
                profile: { name: "playerWithoutBet" },
            };
            mockGameData.ingame.playerWithoutBet = {
                betTracks: {},
            };

            // Act
            const result = await consumer.validateMine(playerWithoutBet, {});

            // Assert
            expect(result).toEqual({
                isValid: false,
                error: noticeHelper.noBetFound,
            });
        });

        it("should return invalid when already cashed out", async () => {
            // Arrange
            mockGameData.ingame.testPlayer.betTracks[Actions.CashOut] = { amount: 100 };

            // Act
            const result = await consumer.validateMine(mockPlayer, {});

            // Assert
            expect(result).toEqual({
                isValid: false,
                error: noticeHelper.alreadyCashOut,
            });
        });

        it("should return valid when bet exists and not cashed out", async () => {
            // Act
            const result = await consumer.validateMine(mockPlayer, {});

            // Assert
            expect(result).toEqual({
                isValid: true,
            });
        });
    });

    describe("handleMine", () => {
        it("should update multiplier when below max multiplier", async () => {
            // Arrange
            const clientSendTime = Date.now();
            const insertMineBetLogSpy = jest.spyOn(consumer, "insertMineBetLog").mockResolvedValue();
            const updatePlayerGameStateSpy = jest.spyOn(consumer, "updatePlayerGameState").mockImplementation();
            getNextMultiplier.mockReturnValue(1.6);

            // Act
            await consumer.handleMine(mockPlayer, mockActiveBet, { clientSendTime });

            // Assert
            expect(getNextMultiplier).toHaveBeenCalledWith(1.5, mockGameData.gameConfigs.crashConfig.fixedStepsMultiplierConfigs[0]);
            expect(insertMineBetLogSpy).toHaveBeenCalledWith(mockPlayer, mockActiveBet, {
                clientSendTime,
                result: 2.0,
                updatedMultiplier: 1.6,
            });
            expect(updatePlayerGameStateSpy).toHaveBeenCalledWith("testPlayer", 1.6);
            expect(mockPublisher.publishMineResult).toHaveBeenCalledWith("player-123", {
                multiplier: 1.6,
                winAmount: 160, // 1.6 * 100
                reachMaxWin: false,
            });
        });

        it("should set multiplier to 0 when above final result", async () => {
            // Arrange
            mockGameData.provablyFair.testPlayer.finalResult = 1.0;
            const insertMineBetLogSpy = jest.spyOn(consumer, "insertMineBetLog").mockResolvedValue();
            const updatePlayerGameStateSpy = jest.spyOn(consumer, "updatePlayerGameState").mockImplementation();
            getNextMultiplier.mockReturnValue(1.6);

            // Act
            await consumer.handleMine(mockPlayer, mockActiveBet, { clientSendTime: Date.now() });

            // Assert
            expect(insertMineBetLogSpy).toHaveBeenCalledWith(
                mockPlayer,
                mockActiveBet,
                expect.objectContaining({
                    updatedMultiplier: 0,
                })
            );
            expect(updatePlayerGameStateSpy).toHaveBeenCalledWith("testPlayer", 0);
            expect(mockPublisher.publishMineResult).toHaveBeenCalledWith("player-123", {
                multiplier: 0,
                winAmount: 0, // 0 * 100
                reachMaxWin: false,
            });
        });

        it("should publish mine failed when already at max multiplier", async () => {
            // Arrange
            mockGameData.ingame.testPlayer.activeBet.currentMultiplier = 2.0; // Set to max multiplier from config
            const publishMineFailedSpy = jest.spyOn(consumer, "publishMineFailed").mockImplementation();

            // Act
            await consumer.handleMine(mockPlayer, mockActiveBet, { clientSendTime: Date.now() });

            // Assert
            expect(publishMineFailedSpy).toHaveBeenCalledWith(mockPlayer, noticeHelper.invalidMine);
        });

        it("should call settleCashOutConsumer when multiplier is 0", async () => {
            // Arrange
            mockGameData.provablyFair.testPlayer.finalResult = 1.0;
            getNextMultiplier.mockReturnValue(1.6);
            jest.spyOn(consumer, "insertMineBetLog").mockResolvedValue();
            jest.spyOn(consumer, "updatePlayerGameState").mockImplementation();

            // Act
            await consumer.handleMine(mockPlayer, mockActiveBet, { clientSendTime: Date.now() });

            // Assert
            expect(mockSettleCashOutConsumer.proceedCashOut).toHaveBeenCalledWith({
                player: mockPlayer,
                isAutoCashOut: true,
            });
        });

        it("should call settleCashOutConsumer when reaching max multiplier through progression", async () => {
            // Arrange
            mockGameData.ingame.testPlayer.activeBet.currentMultiplier = 1.9; // One step below max
            getNextMultiplier.mockReturnValue(2.0); // Return max multiplier
            jest.spyOn(consumer, "insertMineBetLog").mockResolvedValue();
            jest.spyOn(consumer, "updatePlayerGameState").mockImplementation();

            // Act
            await consumer.handleMine(mockPlayer, mockActiveBet, { clientSendTime: Date.now() });

            // Assert
            expect(mockSettleCashOutConsumer.proceedCashOut).toHaveBeenCalledWith({
                player: mockPlayer,
                isAutoCashOut: true,
            });
        });

        it("should calculate win amount correctly", async () => {
            // Arrange
            mockGameData.provablyFair.testPlayer.finalResult = 3.0; // Set high final result
            getNextMultiplier.mockReturnValue(1.6);
            jest.spyOn(consumer, "insertMineBetLog").mockResolvedValue();
            jest.spyOn(consumer, "updatePlayerGameState").mockImplementation();

            // Act
            await consumer.handleMine(mockPlayer, mockActiveBet, { clientSendTime: Date.now() });

            // Assert
            expect(mockPublisher.publishMineResult).toHaveBeenCalledWith("player-123", {
                multiplier: 1.6,
                winAmount: 160, // 1.6 * 100
                reachMaxWin: false,
            });
        });

        it("should detect when max win is reached", async () => {
            // Arrange
            const activeBetWithLowMaxWin = { ...mockActiveBet, maxWin: 150 };
            mockGameData.provablyFair.testPlayer.finalResult = 3.0; // Set high final result
            getNextMultiplier.mockReturnValue(1.6);
            jest.spyOn(consumer, "insertMineBetLog").mockResolvedValue();
            jest.spyOn(consumer, "updatePlayerGameState").mockImplementation();

            // Act
            await consumer.handleMine(mockPlayer, activeBetWithLowMaxWin, { clientSendTime: Date.now() });

            // Assert
            expect(mockPublisher.publishMineResult).toHaveBeenCalledWith("player-123", {
                multiplier: 1.6,
                winAmount: 150, // Math.min(1.6 * 100, 150)
                reachMaxWin: true,
            });
        });
    });

    describe("insertMineBetLog", () => {
        it("should create bet log with all required fields", async () => {
            // Arrange
            const clientSendTime = Date.now();
            const result = 2.0;
            const updatedMultiplier = 1.6;

            // Act
            await consumer.insertMineBetLog(mockPlayer, mockActiveBet, {
                clientSendTime,
                result,
                updatedMultiplier,
            });

            // Assert
            expect(mockBetLogsRepository.create).toHaveBeenCalledWith({
                uid: "player-123",
                name: "testPlayer",
                time: expect.any(Date),
                action: Actions.Mine,
                amount: 100,
                winAmount: 160, // 100 * 1.6
                clientSendTime,
                receivedTime: expect.any(Date),
                freeBet: false,
                result: true,
                multiplier: 1.6,
                roundId: "round-123",
                multiplierMode: 1,
                siteId: "site-456",
                currency: "USD",
                rate: 1.0,
                currencyMultiplier: 1.0,
                currencyCode: "USD",
                operatorId: "op-789",
                playerId: "player-456",
            });
        });

        it("should create bet log without session fields when no session", async () => {
            // Arrange
            const playerWithoutSession = { ...mockPlayer, session: null };
            const clientSendTime = Date.now();

            // Act
            await consumer.insertMineBetLog(playerWithoutSession, mockActiveBet, {
                clientSendTime,
                result: 2.0,
                updatedMultiplier: 1.6,
            });

            // Assert
            const callArgs = mockBetLogsRepository.create.mock.calls[0][0];
            expect(callArgs).not.toHaveProperty("siteId");
            expect(callArgs).not.toHaveProperty("currency");
            expect(callArgs).not.toHaveProperty("rate");
            expect(callArgs).not.toHaveProperty("currencyMultiplier");
            expect(callArgs).not.toHaveProperty("currencyCode");
            expect(callArgs).not.toHaveProperty("operatorId");
            expect(callArgs).not.toHaveProperty("playerId");
        });
    });

    describe("updatePlayerGameState", () => {
        it("should update current multiplier in game data", () => {
            // Act
            consumer.updatePlayerGameState("testPlayer", 2.5);

            // Assert
            expect(mockGameData.ingame.testPlayer.currentMultiplier).toBe(2.5);
        });

        it("should not update when player not in game data", () => {
            // Act
            consumer.updatePlayerGameState("nonExistentPlayer", 2.5);

            // Assert
            expect(mockGameData.ingame.nonExistentPlayer).toBeUndefined();
        });
    });

    describe("publishMineFailed", () => {
        it("should publish game failed bet with error code", () => {
            // Arrange
            const errorCode = "SB1944";

            // Act
            consumer.publishMineFailed(mockPlayer, errorCode);

            // Assert
            expect(mockPublisher.publishGameFailedBet).toHaveBeenCalledWith("player-123", {
                endBet: -1,
                notice: { errorCode },
            });
        });
    });
});
