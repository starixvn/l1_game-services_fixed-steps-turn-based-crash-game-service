import http from "http";

import appConfigs from "./app-configs";

const options = {
    timeout: 2000,
    host: "localhost",
    port: process.env.PORT || appConfigs.hostingPort,
    path: "/", // must be the same as HEALTHCHECK in Dockerfile
};

const request = http.request(options, (res) => {
    console.info(`STATUS: ${res.statusCode}`);
    process.exitCode = res.statusCode === 200 ? 0 : 1;
    process.exit();
});

request.on("error", function (err) {
    console.error("ERROR", err);
    process.exit(1);
});

request.end();
