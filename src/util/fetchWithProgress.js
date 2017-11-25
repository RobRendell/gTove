export function fetchWithProgress(url, options = {}, onProgress) {
    return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.open(options.method || 'get', url);
        Object.keys(options.headers || {}).forEach((key) => {
            xhr.setRequestHeader(key, options.headers[key]);
        });
        xhr.responseType = options.responseType || '';
        xhr.onload = () => {
            return resolve({
                status: xhr.status,
                headers: {
                    get: (header) => (xhr.getResponseHeader(header))
                },
                json: () => (Promise.resolve(JSON.parse(xhr.responseText))),
                binary: () => (Promise.resolve(xhr.response))
            })
        };
        xhr.onerror = reject;
        if (xhr.upload && onProgress)
            xhr.upload.onprogress = onProgress; // event.loaded / event.total * 100 ; //event.lengthComputable
        xhr.send(options.body);
    });
}

