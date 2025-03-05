import { generateResult, getFinalResult } from "../../src/helpers/result-helper";
import fs from "fs";
import Chance from "chance";
import { roundFloat } from "../../src/helpers/number-helper";

const chance = new Chance();

const generateClientSeed = (length = 4, pool = "0123456789") => {
    return chance.string({ pool, length });
};

const generateClientSeeds = () => {
    return [generateClientSeed(), generateClientSeed(), generateClientSeed(), generateClientSeed(), generateClientSeed()];
};

const exportRtpResult = (randomMode = 1, crashAtBase = 3, { minPoint, maxPoint }, numberOfRuns = 1_000_000) => {
    let max = 0;
    let maxwin = 0;
    let crashPointRange = {};
    let totalWinAmount = 0;
    let winCount = 0;
    let totalBetAmount = 0;

    for (let index = 0; index < numberOfRuns; index++) {
        const betAmount = chance.pickone([1, 5, 10, 50, 100]);
        const cashOutPoint = chance.floating({ min: minPoint, max: maxPoint });

        const clientSeeds = generateClientSeeds();
        const serverSeed = generateResult();
        const crashPoint = getFinalResult(serverSeed, clientSeeds);
        const range = Math.round(crashPoint);
        crashPointRange[range] ? crashPointRange[range]++ : (crashPointRange[range] = 1);
        totalBetAmount += betAmount;
        crashPoint > max && (max = crashPoint);
        if (cashOutPoint < crashPoint) {
            winCount++;
            cashOutPoint * betAmount > maxwin && (maxwin = cashOutPoint * betAmount);
            totalWinAmount += roundFloat(cashOutPoint * betAmount);
        }
    }

    let jsonData = "";

    jsonData += `*** RTP *** - ${(totalWinAmount / totalBetAmount) * 100}% \n`;
    jsonData += `*** Win Pecent *** - ${(winCount / numberOfRuns) * 100}% \n`;
    jsonData += `*** Maximum Win *** - ${maxwin} \n`;
    jsonData += `*** Maximum Multiplier *** - ${max}`;
    jsonData += `*** Crash Point Range Keys *** \n ${Object.keys(crashPointRange).join("\n ")}`;
    jsonData += `\n*** Crash Point Range Values *** \n ${Object.values(crashPointRange).join("\n ")}`;

    fs.writeFileSync(`./tests/rtp/stat_[${minPoint},${maxPoint}]_${numberOfRuns}.txt`, jsonData);
};

const minPoint = 1.01,
    maxPoint = 10,
    crashAtBase = 2;

exportRtpResult(1, crashAtBase, { minPoint, maxPoint }, 5_000);
exportRtpResult(1, crashAtBase, { minPoint, maxPoint }, 10_000);
exportRtpResult(1, crashAtBase, { minPoint, maxPoint }, 100_000);
exportRtpResult(1, crashAtBase, { minPoint, maxPoint }, 1_000_000);
