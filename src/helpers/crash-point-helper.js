import { roundFloat } from "./number-helper";

const nthPower = 5;

const a = 0.04,
    b = 0.66,
    c = 1 - b ** 5;

function calculateMultiplier(timeInMilliseconds) {
    const multiplier = (a * (timeInMilliseconds / 1000) + b) ** nthPower + c;

    return roundFloat(multiplier);
}

function calculateCrashTimeInMillisecond(crashPoint) {
    return (1000 * ((crashPoint - c) ** (1 / nthPower) - b)) / a;
}

function findStage(multiplier, stages) {
    return stages.find((stage) => multiplier >= stage.minMultiplier && multiplier <= stage.maxMultiplier);
}

function calculateIncrement(currentMultiplier, multiplierConfigs) {
    const stage = multiplierConfigs.stages?.find(
        (stage) => currentMultiplier >= stage.minMultiplier && currentMultiplier < stage.maxMultiplier
    );

    return stage?.increment ?? 0;
}

function getInitialTapMultiplier(stageConfigs) {
    return stageConfigs.initialMultiplier;
}

function generateTapResult(result) {
    return result > 1.0;
}

export { calculateCrashTimeInMillisecond, calculateIncrement, calculateMultiplier, findStage, generateTapResult, getInitialTapMultiplier };

