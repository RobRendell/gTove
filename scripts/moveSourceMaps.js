import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

function moveSourceMaps(fromDir, toDir) {
    fs.mkdirSync(toDir, {recursive: true});
    const fromFiles = fs.readdirSync(fromDir);
    for (let file of fromFiles) {
        if (file.endsWith('.map')) {
            fs.renameSync(path.join(fromDir, file), path.join(toDir, file));
        }
    }
}

const baseDir = path.join('source-maps', process.env.VITE_BUILD_REVISION_COUNT);
if (fs.existsSync(baseDir)) {
    fs.rmSync(baseDir, {recursive: true});
}
moveSourceMaps('build/assets', path.join(baseDir, 'assets'));
