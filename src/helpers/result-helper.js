import { roundFloat } from "./number-helper";

const generateResult = (finalHash) => {
    const hexValue = finalHash.slice(0, 8);
    const decimalValue = parseInt(hexValue, 16);
    const floatPoint = Math.max((2 ** 32 / (decimalValue + 1)) * (1 - 0.03), 1);

    return Math.min(roundFloat(floatPoint), 1000);
};

const getSettlementResult = () => {};

const generateRawResultForHash = (roundResult) => roundResult;

/**
 * @param {number} multiplier
 * @returns {boolean}
 */
const isBigWin = (multiplier) => multiplier >= 2;

export { generateResult, getSettlementResult, generateRawResultForHash, isBigWin };
