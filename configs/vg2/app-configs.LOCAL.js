export default {
    hostingPort: 5000,
    apiSettings: {
        enabledApi: true,
        apiUrl: "http://l2-game-api-local-service:5000",
        authUrl: "http://l2-auth-api-local-service:5000",
        client: {
            id: "game-server",
            secret: "gameserver@20luminet&",
        },
        useAuthenticate: true,
        requestTimeout: 10000,
        placeBetTimeout: 2000,
        enabledApiLogs: true,
    },
    authenticateSettings: {
        url: "http://l2-auth-api-local-service:5000",
        id: "game-services",
        secret: "gameservices@20luminet&",
        requestTimeout: 10000,
        useAuthenticate: true,
        audiences: ["api", "admin-api"],
    },
    userServiceSettings: {
        url: "http://l2-user-service-local-service:5000",
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
        url: "mongodb://lmn_backend:LmnBackend@10.10.50.13:37101/?replicaSet=L2Local&appName=crashgame",
        options: {
            dbName: "minigame",
            useNewUrlParser: true,
            useUnifiedTopology: true,
            auto_reconnect: true,
        },
    },
    sentry: {
        sentryUrl: "https://acb36eb835d948d68c1aad9873754d51@sentry.lumigame.com/27",
        logIdentifier: "crashgame",
        env: "LOCAL",
    },
    adminSecretKey: "asWDEerfOIdgsdqRTFabvmgh",
    enableCorsWs: false,
    corsUrls: ["http://localhost:7456", "https://l2-games.lumigame.com", "https://l2-admin.lumigame.com", "http://localhost:7000"],
    metrics: {
        enable: true,
        secretKey: "6c1f0f28-70f2-46ae-b031-22624a6cd8df",
    },
    otel: {
        system: "VG",
        enabled: true,
        endpoint: "http://10.10.50.69:4318/v1/traces",
    },
    gameResultSettings: {
        baseUrl: "http://l2-game-result-local-service:5000",
        id: "Game Service",
        key: "b396d3e4-c81d-4c5c-8100-94a8b330f12a",
    },
};
