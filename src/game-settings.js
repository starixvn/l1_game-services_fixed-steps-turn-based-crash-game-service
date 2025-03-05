export default {
    id: 73,
    name: "Spaceflight",
    durations: {
        wholeRound: 60,
        placingBets: 10,
        lockingBet: 3,
        mergeClientSeeds: 0,
        liveTime: -1,
    },
    choices: {},
    choicesMapper: {},
    defaultBetTracks: {},
    numberOfRoundHistory: 11,
    provablyFair: true,
    gameConfigs: {
        stageConfigs: {
            stages: [
                { minMultiplier: 1.01, maxMultiplier: 1.1, increment: 0.01 },
                { minMultiplier: 1.11, maxMultiplier: 10.0, increment: 0.1 },
                { minMultiplier: 11.0, maxMultiplier: 100.0, increment: 1.0 },
                { minMultiplier: 110.0, maxMultiplier: 1000.0, increment: 10.0 },
            ],
            initialMultiplier: 1.01,
        },
    },
};
