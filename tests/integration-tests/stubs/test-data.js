const game = {
    id: 73,
    name: "Spaceflight",
};

const gameConfig = {
    time: "2021-01-27T05:44:23.069+00:00",
    type: 0,
    name: "spaceflight",
    enabled: true,
    botenabled: true,
    minbet: 1,
    maxbet: 2000,
    disabledround: 0,
    bot_maxbet: 2000,
    hour_maxbot: [0, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0, 0, 0, 0, 0, 0, 0],
    disabled_message: "Game đang được bảo trì, vui lòng quay lại sau 10 phút.",
    choices_maxbet: {},
    odds: {},
    delayStartTime: 0,
    enableFreeBet: false,
    siteExclusions: null,
    smartBotEnabled: false,
    smartBotGroupRatio: 0,
    exchangeReload: false,
    reloadExchange: true,
    randomMode: 2,
    displayName: "Space Flight",
    gameId: 73,
    crashConfig: {
        maxWinPerRound: 1000,
        maxMultiplier: 2000,
    },
};

const currencyData = { code: "USD", name: "$US" };

const userBetData = ({ uid, name, playerId }) => {
    return [
        {
            time: new Date(),
            amount: 100,
            betWin: 0,
            freeBet: false,
            roundId: 1,
            paid: false,
            uid,
            name,
            playerId,
            rate: 1,
            exchangeRateId: 1,
            siteId: "4100300",
            currency: "$US",
            operatorId: "ONEworks1",
            clientSeed: "1234",
        },
    ];
};

const rounds = [
    {
        id: 1,
        result: 2.98,
        exchangeRateId: 1,
    },
    {
        id: 2,
        result: 1.98,
        exchangeRateId: 1,
    },
    {
        id: 3,
        result: 2.2,
        exchangeRateId: 1,
    },
];

const hashResults = [
    {
        clientSeeds: [],
        roundId: 1,
        serverSeedHash: "7c652e8be28522c4b7371fc408481f47910107f5842258b54d918fc70531eb78",
        serverSeed: "a8fcT5f6gZ2cW2GIM7I4aq1AgCnQKaSKAgZpE7hG",
        finalHash:
            "534faade8bd71272c1039f14538cbe2917eed43957e28e142403fc615bdbbe8f54f0794ad697c0aa07a80535922f7926ef1a606424fce63ce4a0e05f788764bc",
        mergeClientSeed: "",
        mergeSeed: "a8fcT5f6gZ2cW2GIM7I4aq1AgCnQKaSKAgZpE7hG",
    },
    {
        clientSeeds: [
            { name: "TennTien", clientSeed: "4474" },
            { name: "ChoiLord88", clientSeed: "2215" },
            { name: "Van83275", clientSeed: "3583" },
            { name: "DefenderDefeat", clientSeed: "0010" },
            { name: "Tecthang", clientSeed: "5342" },
        ],
        roundId: 2,
        serverSeedHash: "1a41b64d07b8ace1999dc2dc26436cfe6452de3e561888e4988eb73b187dcf8b",
        serverSeed: "qfXrBqflDw5SfvDt5jdnRaxUN4y6Kih6MmGLzG9r",
        finalHash:
            "62be9cdf781a47fa9c40a28fe7bc7a46aceded80593b34fabd8f4b2368ecab50d2be3360affc7ca8ffc2e8c819af2a0cc1bbc6bc0113884652e69626b00ce171",
        mergeClientSeed: "44742215358300105342",
        mergeSeed: "qfXrBqflDw5SfvDt5jdnRaxUN4y6Kih6MmGLzG9r44742215358300105342",
    },
    {
        clientSeeds: [
            { name: "Van53206", clientSeed: "6985" },
            { name: "DefenderDefeat", clientSeed: "8064" },
            { name: "TennTien", clientSeed: "0703" },
            { name: "Tecthang", clientSeed: "0837" },
            { name: "Van83275", clientSeed: "6874" },
        ],
        roundId: 3,
        serverSeedHash: "c3f91b09beaf6df73f2693f0ec1f456fb3760113c88bff19e5f6bcdde132c423",
        serverSeed: "GBtyNks2TuvH4b8MDY6aA3o9EfgcjmwKeLxPXRzF",
        __v: 0,
        finalHash:
            "5e49d68e45d4fd11a6617722bfb5a0e02267843c2e80382830de34e2aa42223455b3f736b226dc45b92377d139fd2b4c382462044f6820573e8622d6fa4c1952",
        mergeClientSeed: "69858064070308376874",
        mergeSeed: "GBtyNks2TuvH4b8MDY6aA3o9EfgcjmwKeLxPXRzF69858064070308376874",
    },
];

const socketOptions = {
    socketUri: "http://localhost:5001/user/spaceflight",
    gameName: game.name,
    proxyRoute: "/socket.io",
};

export { currencyData, game, gameConfig, hashResults, rounds, socketOptions, userBetData };
