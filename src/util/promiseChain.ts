import {promiseSleep} from './promiseSleep';

/**
 * A class that queues promises to resolve sequentially, with throttling based on how long they take to resolve, to
 * avoid swamping Google Drive with a stampeding herd of parallel requests.
 */
export class PromiseChain<T> {

    private promiseChain?: Promise<T>;
    private pendingCount = 0;
    private sleepFactor: number;
    private sleepNeeded = 0;

    constructor(sleepFactor = 0.5) {
        this.sleepFactor = sleepFactor;
    }

    queuePromise(promise: Promise<T>): Promise<T> {
        this.pendingCount++;
        let start: number;
        if (!this.promiseChain) {
            this.promiseChain = promise;
            start = Date.now();
        } else {
            this.promiseChain = this.promiseChain
                .then(() => {
                    start = Date.now();
                    const duration = this.sleepNeeded;
                    this.sleepNeeded = 0;
                    return promiseSleep(duration);
                })
                .then(() => (promise));
        }
        this.promiseChain = this.promiseChain
            .then((result) => {
                const time = Date.now() - start;
                this.sleepNeeded = Math.min(1000, Math.round(time * this.sleepFactor));
                if (--this.pendingCount === 0) {
                    this.promiseChain = undefined;
                    this.sleepNeeded = 0;
                }
                return result;
            });
        return this.promiseChain;
    }

}