module.exports = function () {
    globalThis.processStartService.stdin.pause();
    globalThis.processStartService.kill();
}
