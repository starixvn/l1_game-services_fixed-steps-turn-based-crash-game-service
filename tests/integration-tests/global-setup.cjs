const { spawn } = require("child_process");

const startSetupDataProcess = (onSetupDone) => {
    const setupDataProcess = spawn("node", ["--es-module-specifier-resolution=node", "./tests/integration-tests/stubs/test-data-setup.js"]);

    setupDataProcess.stdout.on("data", (data) => {
        console.log(`stdout: ${data}`);
    });

    setupDataProcess.stderr.on("data", (data) => {
        console.log(`stderr: ${data}`);
    });

    setupDataProcess.on("close", (code) => {
        onSetupDone && onSetupDone();
        console.log(`child process exited with code ${code}`);
    });

    return setupDataProcess;
};

const startServiceProcess = (onServiceStarted) => {
    const serviceProcess = spawn("node", [
        "--es-module-specifier-resolution=node",
        "./tests/integration-tests/game-service-setup/game-service-app.js",
        {
            stdio: ["pipe", "pipe", "pipe", "ipc"],
        },
    ]);

    serviceProcess.stdout.on("data", (data) => {
        console.log(`stdout: ${data}`);

        if (data && data.includes("Express server started and running on port 5001")) {
            onServiceStarted && onServiceStarted();
        }
    });

    serviceProcess.stderr.on("data", (data) => {
        console.log(`stderr: ${data}`);
    });

    return serviceProcess;
};

module.exports = async function () {
    return new Promise(function (resolve) {
        startSetupDataProcess(() => {
            globalThis.processStartService = startServiceProcess(() => {
                console.log("Start service job done!");
                resolve();
            });
        });
    });
};
