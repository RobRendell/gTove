const {addWebpackPlugin, override} = require('customize-cra');
const rewireReactHotLoader = require('react-app-rewire-hot-loader');
const execa = require('execa');
const replacePlugin = require('webpack-plugin-replace');

// Technique for injecting git version info from here: https://stackoverflow.com/a/48824432
const gitHash = execa.sync('git', ['rev-parse', '--short', 'HEAD']).stdout;
const gitNumCommits = Number(execa.sync('git', ['rev-list', 'HEAD', '--count']).stdout);
const gitDirty = execa.sync('git', ['status', '-s', '-uall']).stdout.length > 0;

module.exports = override(
    rewireReactHotLoader,
    addWebpackPlugin(new replacePlugin({
        include: ['appVersion.ts'],
        values: {
            '__BUILD_DATE__': Date.now(),
            '__NUM_COMMITS__': gitNumCommits,
            '__GIT_HASH__': gitHash,
            '__GIT_DIRTY__': gitDirty
        }
    }))
);