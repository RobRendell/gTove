export function isCloseTo(value1: number, value2: number) {
    return Math.abs(value1 - value2) <= 0.01;
}

// Round the given number off if it is close to an integer.
export function snapNumberToCloseInteger(value: number) {
    const rounded = Math.round(value);
    return isCloseTo(rounded, value) ? rounded : value;
}

export function ceilAwayFromZero(value: number) {
    return value > 0 ? Math.ceil(value) : Math.floor(value);
}