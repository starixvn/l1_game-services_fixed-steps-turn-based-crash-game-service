import { stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import RecentBetConsumer from "../recent-bet-consumer";

describe("RecentBetConsumer", () => {
    /**
     * @type {RecentBetConsumer}
     */
    let consumer;
    let mockRecentBetsRepository;
    let mockGameData;
    let mockExchangeRatesRepository;

    beforeEach(() => {
        jest.clearAllMocks();

        mockRecentBetsRepository = stubMongoose(mongoose.Model);
        mockExchangeRatesRepository = stubMongoose(mongoose.Model);
        mockGameData = {
            exchangeRates: {
                exId: "exchange-rate-123",
            },
        };

        consumer = new RecentBetConsumer(mockRecentBetsRepository, mockGameData, mockExchangeRatesRepository);
    });
    describe("constructor", () => {
        it("should initialize all dependencies correctly", () => {
            expect(consumer.recentBetsRepository).toBe(mockRecentBetsRepository);
            expect(consumer.gameData).toBe(mockGameData);
            expect(consumer.exchangeRatesRepository).toBe(mockExchangeRatesRepository);
        });
    });

    describe("add", () => {
        const mockPlayer = {
            profile: {
                name: "testPlayer",
            },
            UID: "player-uid-123",
            session: {
                currencyName: "USD",
                operatorId: "op-456",
                playerId: "player-789",
            },
        };

        const mockData = {
            roundId: 123,
            amount: 100,
            baseAmount: 100,
            winningAmount: 500,
            baseWinningAmount: 500,
            multiplier: 5.0,
            rate: 0.2,
        };

        beforeEach(() => {
            mockRecentBetsRepository.create.mockResolvedValue({});
        });

        it("should create recent bet with all correct fields", async () => {
            // Arrange
            const beforeTime = new Date();

            // Act
            await consumer.add(mockPlayer, mockData);

            // Assert
            const callArgs = mockRecentBetsRepository.create.mock.calls[0][0];
            const afterTime = new Date();

            expect(callArgs).toEqual(
                expect.objectContaining({
                    name: "testPlayer",
                    amount: 100,
                    baseAmount: 100,
                    rate: 0.2,
                    exchangeRateId: "exchange-rate-123",
                    roundId: 123,
                    uid: "player-uid-123",
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
            expect(mockRecentBetsRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    currency: "USD",
                    operatorId: "op-456",
                    playerId: "player-789",
                })
            );
        });

        it("should not include session fields when player has no session", async () => {
            // Arrange
            const playerWithoutSession = {
                profile: {
                    name: "testPlayer",
                },
                UID: "player-uid-123",
            };

            // Act
            await consumer.add(playerWithoutSession, mockData);

            // Assert
            const callArgs = mockRecentBetsRepository.create.mock.calls[0][0];
            expect(callArgs).not.toHaveProperty("currency");
            expect(callArgs).not.toHaveProperty("operatorId");
            expect(callArgs).not.toHaveProperty("playerId");
        });

        it("should set playerId in recent bet object when player has session", async () => {
            // Act
            const result = await consumer.add(mockPlayer, mockData);

            // Assert
            expect(result.playerId).toBe("player-789");
        });

        it("should not set playerId in recent bet object when player has no session", async () => {
            // Arrange
            const playerWithoutSession = {
                profile: {
                    name: "testPlayer",
                },
                UID: "player-uid-123",
            };

            // Act
            const result = await consumer.add(playerWithoutSession, mockData);

            // Assert
            expect(result).not.toHaveProperty("playerId");
        });

        it("should return recent bet object", async () => {
            // Act
            const result = await consumer.add(mockPlayer, mockData);

            // Assert
            expect(result).toEqual({
                roundId: 123,
                name: "testPlayer",
                amount: 100,
                baseAmount: 100,
                rate: 0.2,
                time: expect.any(Date),
                exchangeRateId: "exchange-rate-123",
                playerId: "player-789",
            });
        });
    });

    describe("getRecentBets", () => {
        const mockRealPlayer = {
            session: {
                currencyCode: "USD",
            },
        };

        const mockRecentBets = [
            {
                name: "player1",
                amount: 100,
                exchangeRateId: "ex-1",
                time: new Date("2023-01-01"),
            },
            {
                name: "player2",
                amount: 200,
                exchangeRateId: "ex-2",
                time: new Date("2023-01-02"),
            },
        ];

        const mockExchangeRates = [
            { exId: "ex-1", code: { USD: "1.0" } },
            { exId: "ex-2", code: { USD: "1.2" } },
        ];

        beforeEach(() => {
            mockRecentBetsRepository.find.mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue(mockRecentBets),
                    }),
                }),
            });
            jest.spyOn(consumer, "getExchangeRates").mockResolvedValue(mockExchangeRates);
            jest.spyOn(consumer, "updateRecentBetExchangeRateCode");
        });

        it("should query recentBetsRepository with correct filter", async () => {
            // Act
            await consumer.getRecentBets(mockRealPlayer);

            // Assert
            expect(mockRecentBetsRepository.find).toHaveBeenCalledWith(
                {},
                {
                    _id: false,
                    uid: false,
                    roundId: false,
                    currency: false,
                    operatorId: false,
                    __v: false,
                }
            );
        });

        it("should sort by time descending", async () => {
            // Act
            await consumer.getRecentBets(mockRealPlayer);

            // Assert
            const queryChain = mockRecentBetsRepository.find().lean();
            expect(queryChain.sort).toHaveBeenCalledWith({ time: -1 });
        });

        it("should limit to MAX_RECENT_BETS_RECORDS", async () => {
            // Act
            await consumer.getRecentBets(mockRealPlayer);

            // Assert
            const queryChain = mockRecentBetsRepository.find().lean().sort();
            expect(queryChain.limit).toHaveBeenCalledWith(10);
        });

        it("should return empty array when no recent bets found", async () => {
            // Arrange
            mockRecentBetsRepository.find.mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([]),
                    }),
                }),
            });
            jest.spyOn(consumer, "updateExchangeRateCode");

            // Act
            const result = await consumer.getRecentBets(mockRealPlayer);

            // Assert
            expect(result).toEqual([]);
            expect(consumer.updateExchangeRateCode).not.toHaveBeenCalled();
        });

        it("should call updateExchangeRateCode when recent bets found", async () => {
            // Arrange
            jest.spyOn(consumer, "updateExchangeRateCode");

            // Act
            await consumer.getRecentBets(mockRealPlayer);

            // Assert
            expect(consumer.updateExchangeRateCode).toHaveBeenCalledWith(mockRealPlayer, mockRecentBets);
        });

        it("should return reversed recent bets", async () => {
            // Act
            const result = await consumer.getRecentBets(mockRealPlayer);

            // Assert
            expect(result).toEqual([
                {
                    name: "player2",
                    amount: 200,
                    exchangeRateId: "ex-2",
                    time: new Date("2023-01-02"),
                    exchangeRateCode: {
                        USD: 1.2,
                    },
                },
                {
                    name: "player1",
                    amount: 100,
                    exchangeRateId: "ex-1",
                    time: new Date("2023-01-01"),
                    exchangeRateCode: {
                        USD: 1.0,
                    },
                },
            ]);
        });
    });

    describe("updateExchangeRateCode", () => {
        const mockRealPlayer = {
            session: {
                currencyCode: "USD",
            },
        };

        const mockWinners = [{ exchangeRateId: "ex-1" }, { exchangeRateId: "ex-2" }];

        const mockExchangeRates = [
            { exId: "ex-1", code: { USD: "1.0" } },
            { exId: "ex-2", code: { USD: "1.2" } },
        ];

        beforeEach(() => {
            jest.spyOn(consumer, "getExchangeRates").mockResolvedValue(mockExchangeRates);
            jest.spyOn(consumer, "updateRecentBetExchangeRateCode");
        });

        it("should call getExchangeRates with correct exchange rate ids", async () => {
            // Act
            await consumer.updateExchangeRateCode(mockRealPlayer, mockWinners);

            // Assert
            expect(consumer.getExchangeRates).toHaveBeenCalledWith(["ex-1", "ex-2"]);
        });

        it("should call updateRecentBetExchangeRateCode for each winner", async () => {
            // Act
            await consumer.updateExchangeRateCode(mockRealPlayer, mockWinners);

            // Assert
            expect(consumer.updateRecentBetExchangeRateCode).toHaveBeenCalledTimes(2);
        });

        it("should call updateRecentBetExchangeRateCode with correct parameters for first winner", async () => {
            // Act
            await consumer.updateExchangeRateCode(mockRealPlayer, mockWinners);

            // Assert
            expect(consumer.updateRecentBetExchangeRateCode).toHaveBeenCalledWith(mockWinners[0], "USD", mockExchangeRates);
        });

        it("should call updateRecentBetExchangeRateCode with correct parameters for second winner", async () => {
            // Act
            await consumer.updateExchangeRateCode(mockRealPlayer, mockWinners);

            // Assert
            expect(consumer.updateRecentBetExchangeRateCode).toHaveBeenCalledWith(mockWinners[1], "USD", mockExchangeRates);
        });
    });

    describe("updateRecentBetExchangeRateCode", () => {
        const mockWinner = { exchangeRateId: "ex-1" };
        const mockCurrencyCode = "USD";
        const mockExchangeRates = [{ exId: "ex-1", code: { USD: "1.0" } }];

        it("should set exchangeRateCode when exchange rate found", () => {
            // Act
            consumer.updateRecentBetExchangeRateCode(mockWinner, mockCurrencyCode, mockExchangeRates);

            // Assert
            expect(mockWinner.exchangeRateCode).toEqual({
                USD: 1.0,
            });
        });

        it("should not modify winner when exchange rate not found", () => {
            // Arrange
            const mockWinnerClean = { exchangeRateId: "ex-1" };
            const mockExchangeRatesNotFound = [{ exId: "ex-2", code: { USD: "1.0" } }];

            // Act
            consumer.updateRecentBetExchangeRateCode(mockWinnerClean, mockCurrencyCode, mockExchangeRatesNotFound);

            // Assert
            expect(mockWinnerClean).not.toHaveProperty("exchangeRateCode");
        });

        it("should parse exchange rate code as float", () => {
            // Arrange
            const mockExchangeRatesWithString = [{ exId: "ex-1", code: { USD: "1.5" } }];

            // Act
            consumer.updateRecentBetExchangeRateCode(mockWinner, mockCurrencyCode, mockExchangeRatesWithString);

            // Assert
            expect(mockWinner.exchangeRateCode.USD).toBe(1.5);
        });

        it("should handle different currency codes", () => {
            // Arrange
            const mockExchangeRatesEUR = [{ exId: "ex-1", code: { EUR: "0.85" } }];

            // Act
            consumer.updateRecentBetExchangeRateCode(mockWinner, "EUR", mockExchangeRatesEUR);

            // Assert
            expect(mockWinner.exchangeRateCode).toEqual({
                EUR: 0.85,
            });
        });
    });

    describe("update", () => {
        const mockData = {
            roundId: 123,
            winningAmount: 500,
            baseWinningAmount: 500,
            multiplier: 5.0,
        };

        const mockUpdatedRecentBet = {
            name: "testPlayer",
            amount: 100,
            baseAmount: 100,
            rate: 0.2,
            time: new Date(),
            exchangeRateId: "exchange-rate-123",
            roundId: 123,
            currency: "USD",
            multiplier: 5.0,
            winningAmount: 500,
            baseWinningAmount: 500,
        };

        beforeEach(() => {
            mockRecentBetsRepository.findOneAndUpdate.mockResolvedValue(mockUpdatedRecentBet);
        });

        it("should call findOneAndUpdate with correct parameters", async () => {
            // Act
            await consumer.update(mockData);

            // Assert
            expect(mockRecentBetsRepository.findOneAndUpdate).toHaveBeenCalledWith(
                { roundId: 123 },
                { $set: { multiplier: 5.0, winningAmount: 500, baseWinningAmount: 500 } },
                { new: true, lean: true, select: "-_id -uid -__v -playerId -operatorId" }
            );
        });

        it("should return updated recent bet without excluded fields", async () => {
            // Act
            const result = await consumer.update(mockData);

            // Assert
            expect(result).toEqual(mockUpdatedRecentBet);
            expect(result).not.toHaveProperty("_id");
            expect(result).not.toHaveProperty("uid");
            expect(result).not.toHaveProperty("__v");
            expect(result).not.toHaveProperty("playerId");
            expect(result).not.toHaveProperty("operatorId");
        });

        it("should return null when recent bet not found", async () => {
            // Arrange
            mockRecentBetsRepository.findOneAndUpdate.mockResolvedValue(null);

            // Act
            const result = await consumer.update(mockData);

            // Assert
            expect(result).toBeNull();
        });
    });

    describe("getExchangeRates", () => {
        const mockExIds = ["ex-1", "ex-2"];

        beforeEach(() => {
            mockExchangeRatesRepository.find.mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue([
                        { exId: "ex-1", code: { USD: "1.0" } },
                        { exId: "ex-2", code: { USD: "1.2" } },
                    ]),
                }),
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
                { exId: "ex-2", code: { USD: "1.2" } },
            ]);
        });
    });
});
