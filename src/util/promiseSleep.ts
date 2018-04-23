export function promiseSleep(delay: number) {
    return new Promise((resolve) => setTimeout(resolve, delay));
}