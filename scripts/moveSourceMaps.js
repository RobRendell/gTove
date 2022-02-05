const fs = require('fs');
const path = require('path');
require('dotenv').config();

function moveSourceMaps(fromDir, toDir) {
    fs.mkdirSync(toDir, {recursive: true});
    const fromFiles = fs.readdirSync(fromDir);
    for (let file of fromFiles) {
        if (file.endsWith('.map')) {
            fs.copyFileSync(path.join(fromDir, file), path.join(toDir, file));
        }
    }
}

const baseDir = path.join('source-maps', process.env.REACT_APP_BUILD_REVISION_COUNT);
if (fs.existsSync(baseDir)) {
    fs.rmSync(baseDir, {recursive: true});
}
moveSourceMaps('build/static/css', path.join(baseDir, 'css'));
moveSourceMaps('build/static/js', path.join(baseDir, 'js'));
