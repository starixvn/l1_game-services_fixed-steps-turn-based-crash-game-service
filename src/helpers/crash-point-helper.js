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

export { calculateIncrement, findStage, generateTapResult, getInitialTapMultiplier };

