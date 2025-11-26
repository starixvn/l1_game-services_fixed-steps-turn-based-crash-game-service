import axios from "axios";
import { GameResultServiceConsumer } from "../game-result-service-consumer";

// Mock axios
jest.mock("axios");
const mockedAxios = axios;

describe("GameResultServiceConsumer", () => {
    let consumer;
    let mockDefinition;
    let mockAppConfigs;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockDefinition = {
            id: "game123",
            name: "Test Game"
        };

        mockAppConfigs = {
            gameResultSettings: {
                id: "api-id-123",
                key: "api-key-456",
                baseUrl: "https://api.example.com"
            }
        };

        consumer = new GameResultServiceConsumer({
            definition: mockDefinition,
            appConfigs: mockAppConfigs
        });
    });

    describe("Constructor", () => {
        it("should initialize with definition", () => {
            // Assert
            expect(consumer.definition).toBe(mockDefinition);
        });

        it("should initialize with apiSettings from appConfigs", () => {
            // Assert
            expect(consumer.apiSettings).toBe(mockAppConfigs.gameResultSettings);
        });
    });

    describe("getUrl", () => {
        const mockResponse = {
            data: {
                url: "https://example.com/bet-history/123",
                token: "access-token-xyz"
            }
        };

        beforeEach(() => {
            mockedAxios.post.mockResolvedValue(mockResponse);
        });

        it("should make POST request to correct URL", async () => {
            // Arrange
            const params = {
                playerId: "player123",
                operatorId: "op456",
                siteId: "site789",
                roundId: "round101",
                mode: "landscape",
                timeZoneOffset: -5,
                language: "en"
            };

            // Act
            await consumer.getUrl(params);

            // Assert
            expect(mockedAxios.post).toHaveBeenCalled();
        });

        it("should use correct base URL for request", async () => {
            // Arrange
            const params = {
                playerId: "player123",
                operatorId: "op456",
                siteId: "site789",
                roundId: "round101",
                mode: "landscape",
                timeZoneOffset: -5,
                language: "en"
            };

            // Act
            await consumer.getUrl(params);

            // Assert
            const callArgs = mockedAxios.post.mock.calls[0];
            expect(callArgs[0]).toContain("https://api.example.com/BetHistory/GetAccessUrl");
        });

    });

});
