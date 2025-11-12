function roundFloat(number, fractionDigits = 2) {
    return Math.round(+number * 10 ** fractionDigits) / 10 ** fractionDigits;
}

function roundMultiplier(a, b, fractionDigits = 2) {
    return +(Math.round(a * b * 10 ** (fractionDigits + 1)) / 10 ** (fractionDigits + 1)).toFixed(fractionDigits);
}

function roundSubtract(a, b, fractionDigits = 2) {
    return +(Math.round(a * 10 ** (fractionDigits + 1) - b * 10 ** (fractionDigits + 1)) / 10 ** (fractionDigits + 1)).toFixed(
        fractionDigits
    );
}

export { roundFloat, roundMultiplier, roundSubtract };

