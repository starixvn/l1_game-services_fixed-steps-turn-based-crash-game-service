export function addMillisecond(date, millisecond) {
    const result = new Date(date);

    result.setMilliseconds(result.getMilliseconds() + millisecond);

    return result;
}
