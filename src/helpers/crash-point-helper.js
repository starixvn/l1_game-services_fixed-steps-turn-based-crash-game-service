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

    const multiplierSteps = currentMultiplierConfig.multiplierSteps;
    const currentIndex = multiplierSteps.findIndex((multiplierStep) => multiplierStep >= multiplier);

    if (currentIndex === -1 || currentIndex >= multiplierSteps.length - 1) {
        return 0;
    }

    return multiplierSteps[currentIndex + 1] - multiplier;
}

export { calculateIncrement, generateTapResult, getInitialTapMultiplier };

