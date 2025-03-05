import { CurrencyGroupGames } from "sc-game-base/src/core/models";

export const createCurrencyGroupGames = async (currencyGroupId, gameId, gameConfig) => {
    const data = {
        enabled: true,
        coinValues: [],
        stakeLevels: [],
        groupId: currencyGroupId,
        maxWinPerRound: 50000,
        minBet: 1,
        maxBet: 2000,
        chips: [1, 2, 5, 10, 50, 100, 200, 500, 1000, 2000],
    };

    return CurrencyGroupGames.create({ gameId, ...gameConfig, ...data });
};
