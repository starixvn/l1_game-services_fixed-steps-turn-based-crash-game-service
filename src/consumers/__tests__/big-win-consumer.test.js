import { stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import BigWinConsumer from "../big-win-consumer";

describe("BigWinConsumer", () => {
    let consumer;
    let mockBigWinsRepository;
    let mockGameData;
    let mockExchangeRatesRepository;

    beforeEach(() => {
        jest.clearAllMocks();

        mockBigWinsRepository = stubMongoose(mongoose.Model);
        mockExchangeRatesRepository = stubMongoose(mongoose.Model);
        mockGameData = {
            exchangeRates: {
                exId: "exchange-rate-123"
            }
        };

        consumer = new BigWinConsumer(
            mockBigWinsRepository,
            mockGameData,
            mockExchangeRatesRepository
        );
    });
    describe("constructor", () => {
        it("should initialize all dependencies correctly", () => {
            expect(consumer.bigWinsRepository).toBe(mockBigWinsRepository);
            expect(consumer.gameData).toBe(mockGameData);
            expect(consumer.exchangeRatesRepository).toBe(mockExchangeRatesRepository);
        });
    });

    describe("add", () => {
        const mockPlayer = {
            profile: {
                name: "testPlayer"
            },
            UID: "player-uid-123",
            session: {
                currencyName: "USD",
                operatorId: "op-456",
                playerId: "player-789"
            }
        };

        const mockData = {
            roundId: "round-123",
            amount: 100,
            baseAmount: 100,
            winningAmount: 500,
            baseWinningAmount: 500,
            multiplier: 5.0,
            rate: 0.2
        };

        beforeEach(() => {
            mockBigWinsRepository.create.mockResolvedValue({});
        });

        it("should create big win with all correct fields", async () => {
            // Arrange
            const beforeTime = new Date();

            // Act
            await consumer.add(mockPlayer, mockData);

            // Assert
            const callArgs = mockBigWinsRepository.create.mock.calls[0][0];
            const afterTime = new Date();

            expect(callArgs).toEqual(
                expect.objectContaining({
                    name: "testPlayer",
                    amount: 100,
                    baseAmount: 100,
                    winningAmount: 500,
                    baseWinningAmount: 500,
                    multiplier: 5.0,
                    rate: 0.2,
                    exchangeRateId: "exchange-rate-123",
                    roundId: "round-123",
                    uid: "player-uid-123"
                })
            );
            expect(callArgs.time).toBeInstanceOf(Date);
            expect(callArgs.time.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
            expect(callArgs.time.getTime()).toBeLessThanOrEqual(afterTime.getTime());
        });

        it("should include currency, operatorId, and playerId when player has session", async () => {
            // Act
            await consumer.add(mockPlayer, mockData);

            // Assert
            expect(mockBigWinsRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    currency: "USD",
                    operatorId: "op-456",
                    playerId: "player-789"
                })
            );
        });

        it("should not include session fields when player has no session", async () => {
            // Arrange
            const playerWithoutSession = {
                profile: {
                    name: "testPlayer"
                },
                UID: "player-uid-123"
            };

            // Act
            await consumer.add(playerWithoutSession, mockData);

            // Assert
            const callArgs = mockBigWinsRepository.create.mock.calls[0][0];
            expect(callArgs).not.toHaveProperty("currency");
            expect(callArgs).not.toHaveProperty("operatorId");
            expect(callArgs).not.toHaveProperty("playerId");
        });

        it("should set playerId in bigWin object when player has session", async () => {
            // Act
            const result = await consumer.add(mockPlayer, mockData);

            // Assert
            expect(result.playerId).toBe("player-789");
        });

        it("should not set playerId in bigWin object when player has no session", async () => {
            // Arrange
            const playerWithoutSession = {
                profile: {
                    name: "testPlayer"
                },
                UID: "player-uid-123"
            };

            // Act
            const result = await consumer.add(playerWithoutSession, mockData);

            // Assert
            expect(result).not.toHaveProperty("playerId");
        });

        it("should return bigWin object", async () => {
            // Act
            const result = await consumer.add(mockPlayer, mockData);

            // Assert
            expect(result).toEqual({
                name: "testPlayer",
                amount: 100,
                baseAmount: 100,
                winningAmount: 500,
                baseWinningAmount: 500,
                multiplier: 5.0,
                rate: 0.2,
                time: expect.any(Date),
                exchangeRateId: "exchange-rate-123",
                playerId: "player-789"
            });
        });
    });

    describe("getRecentBigWinningWinners", () => {
        const mockRealPlayer = {
            session: {
                currencyCode: "USD"
            }
        };

        const mockBigWins = [
            {
                name: "player1",
                amount: 100,
                exchangeRateId: "ex-1",
                time: new Date("2023-01-01")
            },
            {
                name: "player2",
                amount: 200,
                exchangeRateId: "ex-2",
                time: new Date("2023-01-02")
            }
        ];

        const mockExchangeRates = [
            { exId: "ex-1", code: { USD: "1.0" } },
            { exId: "ex-2", code: { USD: "1.2" } }
        ];

        beforeEach(() => {
            mockBigWinsRepository.find.mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue(mockBigWins)
                    })
                })
            });
            jest.spyOn(consumer, "getExchangeRates").mockResolvedValue(mockExchangeRates);
            jest.spyOn(consumer, "updateBigWinExchangeRateCode");
        });

        it("should query bigWinsRepository with correct filter", async () => {
            // Act
            await consumer.getRecentBigWinningWinners(mockRealPlayer);

            // Assert
            expect(mockBigWinsRepository.find).toHaveBeenCalledWith({}, {
                _id: false,
                uid: false,
                roundId: false,
                currency: false,
                operatorId: false,
                __v: false
            });
        });

        it("should sort by time descending", async () => {
            // Act
            await consumer.getRecentBigWinningWinners(mockRealPlayer);

            // Assert
            const queryChain = mockBigWinsRepository.find().lean();
            expect(queryChain.sort).toHaveBeenCalledWith({ time: -1 });
        });

        it("should limit to MAX_BIG_WINS_RECORDS", async () => {
            // Act
            await consumer.getRecentBigWinningWinners(mockRealPlayer);

            // Assert
            const queryChain = mockBigWinsRepository.find().lean().sort();
            expect(queryChain.limit).toHaveBeenCalledWith(10);
        });

        it("should return empty array when no big wins found", async () => {
            // Arrange
            mockBigWinsRepository.find.mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([])
                    })
                })
            });
            jest.spyOn(consumer, "updateExchangeRateCode");

            // Act
            const result = await consumer.getRecentBigWinningWinners(mockRealPlayer);

            // Assert
            expect(result).toEqual([]);
            expect(consumer.updateExchangeRateCode).not.toHaveBeenCalled();
        });

        it("should call updateExchangeRateCode when big wins found", async () => {
            // Arrange
            jest.spyOn(consumer, "updateExchangeRateCode");

            // Act
            await consumer.getRecentBigWinningWinners(mockRealPlayer);

            // Assert
            expect(consumer.updateExchangeRateCode).toHaveBeenCalledWith(mockRealPlayer, mockBigWins);
        });

        it("should return reversed big wins", async () => {
            // Act
            const result = await consumer.getRecentBigWinningWinners(mockRealPlayer);

            // Assert
            expect(result).toEqual([
                {
                    name: "player2",
                    amount: 200,
                    exchangeRateId: "ex-2",
                    time: new Date("2023-01-02"),
                    exchangeRateCode: {
                        USD: 1.2
                    }
                },
                {
                    name: "player1",
                    amount: 100,
                    exchangeRateId: "ex-1",
                    time: new Date("2023-01-01"),
                    exchangeRateCode: {
                        USD: 1.0
                    }
                }
            ]);
        });
    });

    describe("updateExchangeRateCode", () => {
        const mockRealPlayer = {
            session: {
                currencyCode: "USD"
            }
        };

        const mockWinners = [
            { exchangeRateId: "ex-1" },
            { exchangeRateId: "ex-2" }
        ];

        const mockExchangeRates = [
            { exId: "ex-1", code: { USD: "1.0" } },
            { exId: "ex-2", code: { USD: "1.2" } }
        ];

        beforeEach(() => {
            jest.spyOn(consumer, "getExchangeRates").mockResolvedValue(mockExchangeRates);
            jest.spyOn(consumer, "updateBigWinExchangeRateCode");
        });

        it("should call getExchangeRates with correct exchange rate ids", async () => {
            // Act
            await consumer.updateExchangeRateCode(mockRealPlayer, mockWinners);

            // Assert
            expect(consumer.getExchangeRates).toHaveBeenCalledWith(["ex-1", "ex-2"]);
        });

        it("should call updateBigWinExchangeRateCode for each winner", async () => {
            // Act
            await consumer.updateExchangeRateCode(mockRealPlayer, mockWinners);

            // Assert
            expect(consumer.updateBigWinExchangeRateCode).toHaveBeenCalledTimes(2);
        });

        it("should call updateBigWinExchangeRateCode with correct parameters for first winner", async () => {
            // Act
            await consumer.updateExchangeRateCode(mockRealPlayer, mockWinners);

            // Assert
            expect(consumer.updateBigWinExchangeRateCode).toHaveBeenCalledWith(
                mockWinners[0],
                "USD",
                mockExchangeRates
            );
        });

        it("should call updateBigWinExchangeRateCode with correct parameters for second winner", async () => {
            // Act
            await consumer.updateExchangeRateCode(mockRealPlayer, mockWinners);

            // Assert
            expect(consumer.updateBigWinExchangeRateCode).toHaveBeenCalledWith(
                mockWinners[1],
                "USD",
                mockExchangeRates
            );
        });
    });

    describe("updateBigWinExchangeRateCode", () => {
        const mockWinner = { exchangeRateId: "ex-1" };
        const mockCurrencyCode = "USD";
        const mockExchangeRates = [
            { exId: "ex-1", code: { USD: "1.0" } }
        ];

        it("should set exchangeRateCode when exchange rate found", () => {
            // Act
            consumer.updateBigWinExchangeRateCode(mockWinner, mockCurrencyCode, mockExchangeRates);

            // Assert
            expect(mockWinner.exchangeRateCode).toEqual({
                USD: 1.0
            });
        });

        it("should not modify winner when exchange rate not found", () => {
            // Arrange
            const mockWinnerClean = { exchangeRateId: "ex-1" };
            const mockExchangeRatesNotFound = [
                { exId: "ex-2", code: { USD: "1.0" } }
            ];

            // Act
            consumer.updateBigWinExchangeRateCode(mockWinnerClean, mockCurrencyCode, mockExchangeRatesNotFound);

            // Assert
            expect(mockWinnerClean).not.toHaveProperty("exchangeRateCode");
        });

        it("should parse exchange rate code as float", () => {
            // Arrange
            const mockExchangeRatesWithString = [
                { exId: "ex-1", code: { USD: "1.5" } }
            ];

            // Act
            consumer.updateBigWinExchangeRateCode(mockWinner, mockCurrencyCode, mockExchangeRatesWithString);

            // Assert
            expect(mockWinner.exchangeRateCode.USD).toBe(1.5);
        });

        it("should handle different currency codes", () => {
            // Arrange
            const mockExchangeRatesEUR = [
                { exId: "ex-1", code: { EUR: "0.85" } }
            ];

            // Act
            consumer.updateBigWinExchangeRateCode(mockWinner, "EUR", mockExchangeRatesEUR);

            // Assert
            expect(mockWinner.exchangeRateCode).toEqual({
                EUR: 0.85
            });
        });
    });

    describe("getExchangeRates", () => {
        const mockExIds = ["ex-1", "ex-2"];

        beforeEach(() => {
            mockExchangeRatesRepository.find.mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue([
                        { exId: "ex-1", code: { USD: "1.0" } },
                        { exId: "ex-2", code: { USD: "1.2" } }
                    ])
                })
            });
        });

        it("should query exchangeRatesRepository with correct filter", async () => {
            // Act
            await consumer.getExchangeRates(mockExIds);

            // Assert
            expect(mockExchangeRatesRepository.find).toHaveBeenCalledWith(
                { exId: { $in: ["ex-1", "ex-2"] } },
                { _id: false, exId: true, code: true }
            );
        });

        it("should return exchange rates", async () => {
            // Act
            const result = await consumer.getExchangeRates(mockExIds);

            // Assert
            expect(result).toEqual([
                { exId: "ex-1", code: { USD: "1.0" } },
                { exId: "ex-2", code: { USD: "1.2" } }
            ]);
        });
    });
});
