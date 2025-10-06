function findStage(multiplier, stages) {
    return stages.find((stage) => multiplier >= stage.minMultiplier && multiplier <= stage.maxMultiplier);
}

function getInitialTapMultiplier(stageConfigs) {
    return stageConfigs.initialMultiplier;
}

function generateTapResult(result) {
    return result > 1.0;
}

function calculateIncrement(multiplier, currentMultiplierConfig) {
    if (!currentMultiplierConfig) {
        return 0;
    }

    const values = currentMultiplierConfig.values;
    const currentIndex = values.findIndex((value) => value >= multiplier);

    if (currentIndex === -1 || currentIndex >= values.length - 1) {
        return 0;
    }

    return values[currentIndex + 1] - multiplier;
}

export { calculateIncrement, findStage, generateTapResult, getInitialTapMultiplier };

