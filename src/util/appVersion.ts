// Technique for accessing git version info from here: https://stackoverflow.com/a/48824432
export interface AppVersion {
    /** build timestamp in milliseconds since the epoch */
    readonly buildDate: number;

    /** number of commits in the Git repo */
    readonly numCommits: number;

    /** latest Git commit hash */
    readonly hash: string;

    /** flag is set when uncommitted or untracked changes are present in the workspace */
    readonly dirty: boolean;
}

export const appVersion: AppVersion = {
    buildDate: Number('__BUILD_DATE__'),
    numCommits: Number('__NUM_COMMITS__'),
    hash: '__GIT_HASH__',
    dirty: Boolean('__GIT_DIRTY__')
};