import {combineReducers} from 'redux';
import {without} from 'lodash';

import * as constants from '../util/constants';

export const ADD_FILES_ACTION = 'add_files_action';
const REMOVE_FILE_ACTION = 'remove_file_action';

function driveMetadataReducer(state = {}, action) {
    switch (action.type) {
        case ADD_FILES_ACTION:
            return {...state, ...action.files};
        case REMOVE_FILE_ACTION:
            let result = {...state};
            delete(result[action.file.id]);
            return result;
        default:
            return state;
    }
}

function childrenReducer (state = {}, action) {
    switch (action.type) {
        case ADD_FILES_ACTION:
            return Object.keys(action.files).reduce((result, fileId) => {
                action.files[fileId].parents.forEach((parent) => {
                    result[parent] = [...(result[parent] || []), fileId];
                });
                return result;
            }, {...state});
        case REMOVE_FILE_ACTION:
            let result = {...state};
            delete(result[action.file.id]);
            action.file.parents.forEach((parent) => {
                result[parent] = without(result[parent], action.file.id);
            });
            return result;
        default:
            return state;
    }
}

function findRoot (fileId, driveMetadata, rootForFile) {
    if (!driveMetadata[fileId]) {
        return fileId;
    } else {
        if (!rootForFile[fileId]) {
            rootForFile[fileId] = driveMetadata[fileId].parents.reduce((result, parentId) => {
                return result || findRoot(parentId, driveMetadata, rootForFile);
            }, null);
        }
        return rootForFile[fileId];
    }
}

function findRootFolders (roots = null, driveMetadata, children) {
    if (!roots) {
        let rootForFile = {};
        Object.keys(driveMetadata).forEach((fileId) => {
            findRoot(fileId, driveMetadata, rootForFile);
        });
        // We may not have fetched all the file metadata yet - ensure we have only one root.
        let root = Object.keys(rootForFile).reduce((result, fileId) => {
            return (result === null) ? rootForFile[fileId] :
                ((result !== rootForFile[fileId]) ? undefined : rootForFile[fileId]);
        }, null);
        if (root) {
            const virtualGamingTabletopFolder = children[root][0];
            roots = children[virtualGamingTabletopFolder]
                .reduce((roots, fileId) => {
                    roots[driveMetadata[fileId].name] = fileId;
                    return roots;
                }, {[constants.FOLDER_ROOT]: virtualGamingTabletopFolder});
        }
    }
    return roots;
}

const combinedFileIndexReducer = combineReducers({
    driveMetadata: driveMetadataReducer,
    children: childrenReducer,
    roots: (state = {}) => (state)
});

function fileIndexReducer (state = {}, action) {
    switch (action.type) {
        case ADD_FILES_ACTION:
            let driveMetadata = driveMetadataReducer(state.driveMetadata, action);
            if (driveMetadata === state.driveMetadata) {
                return state;
            } else {
                let children = childrenReducer(state.children, action);
                let roots = findRootFolders(state.roots, driveMetadata, children);
                return {
                    ...state,
                    driveMetadata,
                    children,
                    roots
                };
            }
        case REMOVE_FILE_ACTION:
            return combinedFileIndexReducer(state, action);
        default:
            return state;
    }
}

export default fileIndexReducer;

export function addFilesAction(files) {
    return {type: ADD_FILES_ACTION, files};
}

export function removeFileAction(file) {
    return {type: REMOVE_FILE_ACTION, file};
}

export function getAllFilesFromStore(store) {
    return store.fileIndex;
}