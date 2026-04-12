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

export function findMin<T>(itemList: T[], getScore: (item: T) => number): T | undefined {
    let minScore = Infinity;
    let minIndex = -1;
    for (let index = 0; index < itemList.length; index++) {
        const score = getScore(itemList[index]);
        if (score < minScore) {
            minScore = score;
            minIndex = index;
        }
    }
    return minIndex < 0 ? undefined : itemList[minIndex];
}

export function findMax<T>(itemList: T[], getScore: (item: T) => number | undefined): T | undefined {
    let maxScore = -Infinity;
    let maxIndex = -1;
    for (let index = 0; index < itemList.length; index++) {
        const score = getScore(itemList[index]);
        if (score !== undefined && score > maxScore) {
            maxScore = score;
            maxIndex = index;
        }
    }
    return maxIndex < 0 ? undefined : itemList[maxIndex];
}

export function isValueInRange(value: number, min: number, max: number) {
    return (value >= min && value <= max);
}