const fs = require('fs');
const childProcess = require('child_process');

function writeToEnv(key, value) {
    if (key === undefined) {
        fs.writeFile('.env', '', () => {});
    } else {
        fs.appendFile('.env', `${key}=${(value || '').trim()}\n`, (err) => {
            if (err) {
                console.error(err);
            }
        });
    }
}

writeToEnv(); // Reset .env file

writeToEnv('REACT_APP_FIREBASE_EMULATOR', 'false');
writeToEnv('REACT_APP_BUILD_DATE', Date.now().toString());

childProcess.exec('git rev-list HEAD --count', (err, stdout) => {
    writeToEnv('REACT_APP_BUILD_REVISION_COUNT', stdout);
});

childProcess.exec('git rev-parse --short HEAD', (err, stdout) => {
    writeToEnv('REACT_APP_BUILD_HASH', stdout);
});

childProcess.exec('git status -s -uall', (err, stdout) => {
    writeToEnv('REACT_APP_BUILD_DIRTY', (stdout.length > 0).toString());
});