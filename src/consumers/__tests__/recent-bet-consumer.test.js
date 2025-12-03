import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { RecentBetPublisher } from "../../event-publishers";
import RecentBetConsumer from "../recent-bet-consumer";

jest.mock("../../event-publishers", () => ({
    RecentBetPublisher: jest.fn(),
}));

describe("RecentBetConsumer", () => {
    /**
     * @type {RecentBetConsumer}
     */
    let consumer;
    let mockRecentBetsRepository;
    let mockGameData;
    let mockExchangeRatesRepository;
    /**
     * @type {RecentBetPublisher}
     */
    let mockRecentBetPublisher;

    beforeEach(() => {
        jest.clearAllMocks();

        mockRecentBetsRepository = stubMongoose(mongoose.Model);
        mockExchangeRatesRepository = stubMongoose(mongoose.Model);
        mockRecentBetPublisher = stub(RecentBetPublisher);
        mockGameData = {
            exchangeRates: {
                exId: "exchange-rate-123",
            },
        };

        consumer = new RecentBetConsumer({
            recentBetsRepository: mockRecentBetsRepository,
            gameData: mockGameData,
            exchangeRatesRepository: mockExchangeRatesRepository,
            recentBetPublisher: mockRecentBetPublisher,
        });
    });
    describe("constructor", () => {
        it("should initialize all dependencies correctly", () => {
            expect(consumer.recentBetsRepository).toBe(mockRecentBetsRepository);
            expect(consumer.gameData).toBe(mockGameData);
            expect(consumer.exchangeRatesRepository).toBe(mockExchangeRatesRepository);
            expect(consumer.recentBetPublisher).toBe(mockRecentBetPublisher);
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

        it("should publish recent bet when player has session", async () => {
            // Act
            await consumer.add(mockPlayer, mockData);

            // Assert
            expect(mockRecentBetPublisher.publish).toHaveBeenCalledWith(
                expect.objectContaining({
                    roundId: 123,
                    name: "testPlayer",
                    amount: 100,
                    baseAmount: 100,
                    rate: 0.2,
                    time: expect.any(Date),
                    exchangeRateId: "exchange-rate-123",
                    playerId: "player-789",
                })
            );
        });

        it("should publish recent bet without playerId when player has no session", async () => {
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
            expect(mockRecentBetPublisher.publish).toHaveBeenCalledWith(
                expect.objectContaining({
                    roundId: 123,
                    name: "testPlayer",
                    amount: 100,
                    baseAmount: 100,
                    rate: 0.2,
                    time: expect.any(Date),
                    exchangeRateId: "exchange-rate-123",
                })
            );
            const publishedBet = mockRecentBetPublisher.publish.mock.calls[0][0];
            expect(publishedBet).not.toHaveProperty("playerId");
        });
    });

    describe("getRecentBets", () => {
        const mockRecentBets = [
            {
                name: "player1",
                amount: 100,
                baseAmount: 100,
                rate: 0.2,
                exchangeRateId: "ex-1",
                roundId: 123,
                time: new Date("2023-01-01"),
                multiplier: 2.5,
                winningAmount: 250,
                baseWinningAmount: 250,
            },
            {
                name: "player2",
                amount: 200,
                baseAmount: 200,
                rate: 0.3,
                exchangeRateId: "ex-2",
                roundId: 124,
                time: new Date("2023-01-02"),
                multiplier: 3.0,
                winningAmount: 600,
                baseWinningAmount: 600,
            },
        ];

        beforeEach(() => {
            mockRecentBetsRepository.find.mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue(mockRecentBets),
                }),
            });
        });

        it("should query recentBetsRepository with correct filter", async () => {
            // Act
            await consumer.getRecentBets();

            // Assert
            expect(mockRecentBetsRepository.find).toHaveBeenCalledWith(
                {},
                { _id: false, uid: false, currency: false, operatorId: false, __v: false }
            );
        });

        it("should limit to MAX_RECENT_BETS_RECORDS (10)", async () => {
            // Act
            await consumer.getRecentBets();

            // Assert
            const queryChain = mockRecentBetsRepository.find().lean();
            expect(queryChain.limit).toHaveBeenCalledWith(10);
        });

        it("should return empty array when no recent bets found", async () => {
            // Arrange
            mockRecentBetsRepository.find.mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue([]),
                }),
            });

            // Act
            const result = await consumer.getRecentBets();

            // Assert
            expect(result).toEqual([]);
        });

        it("should return recent bets when found", async () => {
            // Act
            const result = await consumer.getRecentBets();

            // Assert
            expect(result).toEqual(mockRecentBets);
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

        it("should publish updated recent bet", async () => {
            // Act
            await consumer.update(mockData);

            // Assert
            expect(mockRecentBetPublisher.publish).toHaveBeenCalledWith(mockUpdatedRecentBet);
        });

        it("should not publish when recent bet not found", async () => {
            // Arrange
            mockRecentBetsRepository.findOneAndUpdate.mockResolvedValue(null);

            // Act
            await consumer.update(mockData);

            // Assert
            expect(mockRecentBetPublisher.publish).not.toHaveBeenCalled();
        });
    });

});
