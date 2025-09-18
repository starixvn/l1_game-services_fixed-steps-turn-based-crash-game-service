export default {
    hostingPort: 5000,
    apiSettings: {
        enabledApi: true,
        apiUrl: "http://l2_game_api_prod:5000",
        authUrl: "http://l2_auth_api_prod:5000",
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
        url: "http://l2_auth_api_prod:5000",
        id: "game-services",
        secret: "gameservices@20luminet&",
        requestTimeout: 10000,
        useAuthenticate: true,
        audiences: ["api", "admin-api"],
    },
    userServiceSettings: {
        url: "http://l2_user_service_prod:5000",
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
        url: "mongodb://lmn_backend:%21%23x97%25uYZv%2A%5E%25%3E%7C%2Aqg%40E7FHi%3F9l%7B9r%3CK@10.99.99.53:39210,10.99.99.54:39210,10.99.99.188:39210,10.99.99.187:39210/?replicaSet=L2_SabaMain&appName=crashgame",
        options: {
            dbName: "minigame",
            useNewUrlParser: true,
            useUnifiedTopology: true,
        },
    },
    sentry: {
        sentryUrl: "http://2b5b82bf699543ddb296364568bc30be@10.2.189.50:9009/52",
        logIdentifier: "crashgame",
        env: "PROD",
    },
    adminSecretKey: "asWDEer4yGdgsdqR4uqmKQZgh",
    enableCorsWs: true,
    corsUrls: [
        "https://v-gaming.net",
        "https://www.v-gaming.net",
        "http://v-gaming.net",
        "http://www.v-gaming.net",
        "https://gamesaba.net",
        "https://www.gamesaba.net",
        "http://gamesaba.net",
        "http://www.gamesaba.net",
        "http://admg.v-gaming.net",
        "https://admg.v-gaming.net",
        "http://adm.v-gaming.net",
        "https://adm.v-gaming.net",
    ],
    metrics: {
        enable: true,
        secretKey: "30d15293-c7de-4c77-9293-b85d6c5bfe1a",
    },
    enableMsgpackParser: true,
    otel: {
        system: "VG",
        enabled: true,
        endpoint: "http://10.2.189.50:4318/v1/traces",
    },
    gameResultSettings: {
        baseUrl: "http://l2_game_result_prod:5000",
        id: "Game Service",
        key: "6a578c70-5ff3-4f26-a403-072a672f18df",
    },
};
