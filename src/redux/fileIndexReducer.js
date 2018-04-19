import {combineReducers} from 'redux';
import {without} from 'lodash';

import * as constants from '../util/constants';

export const ADD_FILES_ACTION = 'add_files_action';
const REMOVE_FILE_ACTION = 'remove_file_action';
export const UPDATE_FILE_ACTION = 'update_file_action';

function driveMetadataReducer(state = {}, action) {
    switch (action.type) {
        case ADD_FILES_ACTION:
            return action.files.reduce((all, file) => ({...all, [file.id]: file}), state);
        case REMOVE_FILE_ACTION:
            let result = {...state};
            delete(result[action.file.id]);
            return result;
        case UPDATE_FILE_ACTION:
            return {...state, [action.metadata.id]: action.metadata};
        default:
            return state;
    }
}

function childrenReducer(state = {}, action) {
    switch (action.type) {
        case ADD_FILES_ACTION:
            return action.files.reduce((result, file) => {
                file.parents && file.parents.forEach((parent) => {
                    result[parent] = [...(result[parent] || []), file.id];
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

function rootsReducer(state = {}, action) {
    if (action.type === ADD_FILES_ACTION && (action.parent === null || action.parent === state[constants.FOLDER_ROOT])) {
        // These files are the roots.
        return action.files.reduce((result, file) => ({...result, [file.name]: file.id}), state);
    } else {
        return state;
    }
}

const fileIndexReducer = combineReducers({
    driveMetadata: driveMetadataReducer,
    children: childrenReducer,
    roots: rootsReducer
});

export default fileIndexReducer;

export function addFilesAction(files, parent = undefined) {
    return {type: ADD_FILES_ACTION, files, parent};
}

export function removeFileAction(file) {
    return {type: REMOVE_FILE_ACTION, file};
}

export function updateFileAction(metadata, peerKey = null) {
    return {type: UPDATE_FILE_ACTION, metadata, peerKey};
}

export function getAllFilesFromStore(store) {
    return store.fileIndex;
}