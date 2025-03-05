import appConfigs from "./app-configs";

export default Object.assign(appConfigs, {
    hostingPort: 5001,
    authenticateSettings: {
        url: "http://l1_auth_api_local:5000",
        id: "game-services",
        secret: "gameservices@20luminet&",
        requestTimeout: 3000,
        useAuthenticate: false,
        audiences: ["api", "admin-api"],
    },
    database: {
        url: "mongodb://127.0.0.1:27017",
        options: {
            dbName: "game-service-test-db",
            useNewUrlParser: true,
            useUnifiedTopology: true,
            auto_reconnect: true,
        },
    },
});
