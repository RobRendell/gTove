type ServiceWorkerStore = {
    registration?: ServiceWorkerRegistration
}

/**
 * The Redux store can't contain non-serializable objects, so store the service worker registration globally.
 */
export const serviceWorkerStore: ServiceWorkerStore = {
};