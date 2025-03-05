export default {
    hostingPort: 5000,
    apiSettings: {
        enabledApi: true,
        apiUrl: "http://l1-game-api-sit-service:5000",
        authUrl: "http://l1-auth-api-sit-service:5000",
        client: {
            id: "game-server",
            secret: "gameserver@20luminet&",
        },
        useAuthenticate: true,
        requestTimeout: 10000,
        enabledApiLogs: true,
    },
    authenticateSettings: {
        url: "http://l1-auth-api-sit-service:5000",
        id: "game-services",
        secret: "gameservices@20luminet&",
        requestTimeout: 10000,
        useAuthenticate: true,
        audiences: ["api", "admin-api"],
    },
    userServiceSettings: {
        url: "http://l1-user-service-sit-service:5000",
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
        url: "mongodb://lmn_backend:LmnBackend%40517@10.99.99.53:39130,10.99.99.54:39130,10.99.99.188:39130,10.99.99.187:39130/?replicaSet=SabaSIT&appName=crashgame",
        options: {
            dbName: "minigame",
            useNewUrlParser: true,
            useUnifiedTopology: true,
        },
    },
    sentry: {
        sentryUrl: "http://52368c4019044019885440599c180bda@10.2.190.51:9009/24",
        logIdentifier: "crashgame",
        env: "SIT",
    },
    adminSecretKey: "asWDEerfOIdgsdqRTFabvmgh",
    enableCorsWs: true,
    corsUrls: [
        "http://l1sit.sgamesuat.com",
        "https://l1sit.sgamesuat.com",
        "http://l1sitadm.sgamesuat.com",
        "https://l1sitadm.sgamesuat.com",
    ],
    metrics: {
        enable: true,
        secretKey: "6c1f0f28-70f2-46ae-b031-22624a6cd8df",
    },
    enableMsgpackParser: true,
    otel: {
        system: "SG",
        enabled: true,
        endpoint: "http://10.10.50.69:4318/v1/traces",
    },
    gameResultSettings: {
        baseUrl: "http://l1-game-result-sit-service:5000",
        id: "Game Service",
        key: "dded3dfe-261e-47f0-a46e-076b367c5a09",
    },
};
