/**
 * Join several strings together with commas, with "and" between the second last and last elements.
 * @param elements The list of strings to join.
 * @param between The value to insert between the first N - 1 elements (defaults to ', ')
 * @param final The value to insert between the second last and final elements (defaults to ' and ')
 */
export function joinAnd(elements: string[], between: string = ', ', final: string = ' and '): string {
    if (elements.length < 2) {
        return elements.join("");
    } else {
        const end = elements.length - 1;
        const allButLast = elements.slice(0, end);
        return allButLast.join(between) + final + elements[end];
    }
}

const alphanumericSplitRE = /([0-9]+\.?[0-9]*)/gm;

// Base this on react-table's alphanumeric sort algorithm.
export function compareAlphanumeric(string1: string, string2: string) {
    const values1 = string1.split(alphanumericSplitRE).filter(Boolean);
    const values2 = string2.split(alphanumericSplitRE).filter(Boolean);
    if (values1.length === 0 && values2.length === 0) {
        return 0;
    }
    // Keep comparing the pieces until two are different
    for (let index = 0; index < values1.length && index < values2.length; ++index) {
        const piece1 = values1[index];
        const piece2 = values2[index];
        if (piece1 !== piece2) {
            const num1 = parseFloat(piece1);
            const num2 = parseFloat(piece2);
            if (isNaN(num1) && isNaN(num2)) {
                // both strings
                return piece1 < piece2 ? -1 : 1;
            } else if (isNaN(num1) || num1 < num2) {
                return -1;
            } else if (isNaN(num2) || num1 > num2) {
                return 1;
            }
        }
    }
    // Sort empty strings to the end
    return values2.length === 0 ? -1 : values1.length === 0 ? 1 : values1.length - values2.length;
}