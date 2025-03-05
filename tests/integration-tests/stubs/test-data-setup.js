import mongoose from "mongoose";
import { users } from "sc-base-database";
import { middlewares } from "sc-common";
import {
    createDummyCurrency,
    createDummyUsers,
    createExchangeRate,
    createGameConfig,
    createPartnerConfig,
    normalUser,
} from "sc-game-service-integration-utils";
import configs from "../../../src/app-configs.IGT";
import { Bets, Results, Rounds } from "../../../src/models";
import { createCurrencyGroupGames } from "./currency-group-games-stub";
import { currencyData, game, gameConfig, hashResults, rounds as roundDatas, userBetData } from "./test-data";

const connectDatabase = async () => {
    await middlewares.database.configureDatabase(mongoose, configs.database);
    await clearAllData();
};

const clearAllData = async () => {
    const collections = await mongoose.connection.db.collections();

    for (const collection of collections) {
        await collection.deleteMany();
    }
};

const createTestData = async () => {
    await connectDatabase();
    await createExchangeRate();
    await createGameConfig(gameConfig);
    const partnerConfig = await createPartnerConfig(game.id);
    const currency = await createDummyCurrency(partnerConfig.partnerId, currencyData.code, currencyData.name);
    await createCurrencyGroupGames(currency.groupId, game.id, gameConfig);
    await createDummyUsers(currency);
    await createRounds();
    await createUserBetData();
    await createHashResult();
    console.log("Create game config & dummy user for testing successfully!");

    process.exit(0);
};

const createHashResult = async (hash) => {
    await Results(gameConfig.name).insertMany(hashResults);
};

const createRounds = async () => {
    return Rounds(gameConfig.name).insertMany(roundDatas);
};

const getUserId = async (memberId) => {
    const user = await users.findOne({ "local.memberId": memberId }, { _id: true }).lean();
    return user._id.toString();
};

const createUserBetData = async () => {
    const userId = await getUserId(normalUser.playerId);
    const betData = userBetData({ uid: userId, name: normalUser.playerName, playerId: normalUser.playerId });
    return Bets(gameConfig.name).insertMany(betData);
};

createTestData();
