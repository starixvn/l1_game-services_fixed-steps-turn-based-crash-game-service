export default {
    hostingPort: 5000,
    apiSettings: {
        enabledApi: true,
        apiUrl: "http://l1_game_api_prod:5000",
        authUrl: "http://l1_auth_api_prod:5000",
        client: {
            id: "game-server",
            secret: "gameserver@20luminet&",
        },
        useAuthenticate: true,
        placeBetTimeout: 2000,
        requestTimeout: 10000, // 10s
        enabledApiLogs: true,
    },
    authenticateSettings: {
        url: "http://l1_auth_api_prod:5000",
        id: "game-services",
        secret: "gameservices@20luminet&",
        requestTimeout: 10000,
        useAuthenticate: true,
        audiences: ["api", "admin-api"],
    },
    userServiceSettings: {
        url: "http://l1_user_service_prod:5000",
    },
    socketOptions: {
        pingInterval: 60 * 1000,
        pingTimeout: 60 * 1000,
        transports: ["websocket"],
        allowUpgrades: false,
        perMessageDeflate: false,
    },
    enabledLogs: true,
    database: {
        url: "mongodb://lmn_backend:M7K4ttH%2AtZ3ml%3F%29%7CA%5DjN4%3FLBhwF%266IO%3C@10.99.99.53:39110,10.99.99.54:39110,10.99.99.188:39110,10.99.99.187:39110/?replicaSet=SabaMain&appName=crashgame",
        options: {
            dbName: "minigame",
            useNewUrlParser: true,
            useUnifiedTopology: true,
        },
    },
    sentry: {
        sentryUrl: "http://58fc00e79ab34a3bab04a79038760cb8@10.2.189.50:9009/8",
        logIdentifier: "crashgame",
        env: "PROD",
    },
    adminSecretKey: "asWDEer4yGdgsdqR4uqmKQZgh",
    enableCorsWs: true,
    corsUrls: [
        "http://sabagame.com",
        "http://www.sabagame.com",
        "https://sabagame.com",
        "https://www.sabagame.com",
        "https://www.gamesaba.com",
        "https://gamesaba.com",
        "http://www.gamesaba.com",
        "http://gamesaba.com",
        "http://admg.sabagame.com",
        "https://admg.sabagame.com",
        "http://adm.sabagame.com",
        "https://adm.sabagame.com",
    ],
    metrics: {
        enable: true,
        secretKey: "30d15293-c7de-4c77-9293-b85d6c5bfe1a",
    },
    enableMsgpackParser: true,
    otel: {
        system: "SG",
        enabled: true,
        endpoint: "http://10.2.189.50:4318/v1/traces",
    },
    gameResultSettings: {
        baseUrl: "http://l1_game_result_prod:5000",
        id: "Game Service",
        key: "a9c83674-3d96-4b32-a431-142e3fd376fe",
    },
};
