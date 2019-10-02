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