import {OnProgressParams} from './storage/storageContract';

interface FetchWithProgressOptions {
    method?: string;
    headers?: {[key: string]: string};
    responseType?: XMLHttpRequestResponseType;
    body?: any;
}

export interface FetchWithProgressResponse {
    status: number;
    ok: boolean;
    headers: {
        get: (header: string) => string | null;
    };
    json: () => Promise<object>;
    body: () => Promise<object>;
}

export function fetchWithProgress(url: string, options: FetchWithProgressOptions = {}, onProgress?: (progress: OnProgressParams) => void): Promise<FetchWithProgressResponse> {
    return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.open(options.method || 'get', url);
        Object.keys(options.headers || {}).forEach((key) => {
            xhr.setRequestHeader(key, options.headers![key]);
        });
        xhr.responseType = options.responseType || '';
        xhr.onload = () => {
            const result: FetchWithProgressResponse = {
                status: xhr.status,
                ok: xhr.status >= 200 && xhr.status < 300,
                headers: {
                    get: (header) => (xhr.getResponseHeader(header))
                },
                json: () => (Promise.resolve(JSON.parse(xhr.responseText))),
                body: () => (Promise.resolve(xhr.response))
            };
            resolve(result);
        };
        xhr.onerror = reject;
        if (xhr.upload && onProgress)
            xhr.upload.onprogress = onProgress; // event.loaded / event.total * 100 ; //event.lengthComputable
        xhr.send(options.body);
    });
}

