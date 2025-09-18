export default {
    hostingPort: 5000,
    apiSettings: {
        enabledApi: true,
        apiUrl: "http://l2-game-api-klprod-service:5000",
        authUrl: "http://l2-auth-api-klprod-service:5000",
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
        url: "http://l2-auth-api-klprod-service:5000",
        id: "game-services",
        secret: "gameservices@20luminet&",
        requestTimeout: 10000,
        useAuthenticate: true,
        audiences: ["api", "admin-api"],
    },
    userServiceSettings: {
        url: "http://l2-user-service-klprod-service:5000",
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
        url: "mongodb://lmn_backend:%21%23x97%25uYZv%2A%5E%25%3E%7C%2Aqg%40E7FHi%3F9l%7B9r%3CK@10.146.34.26:39210,10.146.34.27:39210,10.146.34.30:39210,10.146.34.28:39210/?replicaSet=L2_SabaMain&appName=crashgame",
        options: {
            dbName: "minigame",
            useNewUrlParser: true,
            useUnifiedTopology: true,
        },
    },
    sentry: {
        sentryUrl: "http://2b5b82bf699543ddb296364568bc30be@sentry-scklprod-ovs.ops-klprod.gamora.prod/52",
        logIdentifier: "crashgame",
        env: "PROD",
    },
    adminSecretKey: "asWDEer4yGdgsdqR4uqmKQZgh",
    enableCorsWs: true,
    corsUrls: [
        "https://vgaming88.net",
        "https://www.vgaming88.net",
        "http://vgaming88.net",
        "http://www.vgaming88.net",
        "https://gamesaba.net",
        "https://www.gamesaba.net",
        "http://gamesaba.net",
        "http://www.gamesaba.net",
        "http://admg.vgaming88.net",
        "https://admg.vgaming88.net",
        "http://adm.vgaming88.net",
        "https://adm.vgaming88.net",
    ],
    metrics: {
        enable: true,
        secretKey: "30d15293-c7de-4c77-9293-b85d6c5bfe1a",
    },
    enableMsgpackParser: true,
    otel: {
        system: "VG",
        enabled: true,
        endpoint: "http://jaeger-collector-sc.ops-klprod.gamora.prod:32318/v1/traces",
    },
    gameResultSettings: {
        baseUrl: "http://l2-game-result-klprod-service:5000",
        id: "Game Service",
        key: "6a578c70-5ff3-4f26-a403-072a672f18df",
    },
};
