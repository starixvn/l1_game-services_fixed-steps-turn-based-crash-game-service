import GameData from "../game-data";

describe("GameData", () => {
    /**
     * @type {GameData}
     */
    let gameData;

    beforeEach(() => {
        gameData = new GameData(30); // 30 seconds remaining time
    });

    describe("constructor", () => {
        it("should initialize with empty betList", () => {
            // Arrange & Act
            const gameData = new GameData(30);

            // Assert
            expect(gameData.betList).toEqual({});
        });
    });

    describe("addPlayerToBetList", () => {
        const playerId = "player123";
        const playerData = {
            name: "John Doe",
            amount: 100,
            rate: 1.5,
        };

        it("should add player to bet list with correct data", () => {
            // Arrange

            // Act
            gameData.addPlayerToBetList(playerId, playerData);

            // Assert
            expect(gameData.betList[playerId]).toMatchObject({
                playerId,
                name: playerData.name,
                amount: playerData.amount,
                rate: playerData.rate,
            });
        });

        it("should add multiple players to bet list", () => {
            // Arrange
            const player1Id = "player1";
            const player2Id = "player2";
            const player1Data = { name: "Alice", amount: 50, rate: 1.2 };
            const player2Data = { name: "Bob", amount: 200, rate: 2.0 };

            // Act
            gameData.addPlayerToBetList(player1Id, player1Data);
            gameData.addPlayerToBetList(player2Id, player2Data);

            // Assert
            expect(Object.keys(gameData.betList)).toHaveLength(2);
            expect(gameData.betList[player1Id]).toMatchObject({
                playerId: player1Id,
                name: player1Data.name,
                amount: player1Data.amount,
                rate: player1Data.rate,
            });
            expect(gameData.betList[player2Id]).toMatchObject({
                playerId: player2Id,
                name: player2Data.name,
                amount: player2Data.amount,
                rate: player2Data.rate,
            });
        });

        it("should overwrite existing player data", () => {
            // Arrange
            const initialData = { name: "Initial", amount: 50, rate: 1.0 };
            const updatedData = { name: "Updated", amount: 100, rate: 1.5 };

            // Act
            gameData.addPlayerToBetList(playerId, initialData);
            gameData.addPlayerToBetList(playerId, updatedData);

            // Assert
            expect(gameData.betList[playerId]).toMatchObject({
                playerId,
                name: updatedData.name,
                amount: updatedData.amount,
                rate: updatedData.rate,
            });
        });
    });
});
