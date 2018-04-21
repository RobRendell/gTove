import {Action, combineReducers, Reducer} from 'redux';
import {without} from 'lodash';

import * as constants from '../util/constants';
import {DriveMetadata} from '../@types/googleDrive';

// =========================== Action types and generators

export enum FileIndexActionTypes {
    ADD_FILES_ACTION = 'add_files_action',
    REMOVE_FILE_ACTION = 'remove_file_action',
    UPDATE_FILE_ACTION = 'update_file_action'
}

interface AddFilesActionType extends Action {
    type: FileIndexActionTypes.ADD_FILES_ACTION;
    files: DriveMetadata[];
    parent: string | null | undefined;
}

export function addFilesAction(files: DriveMetadata[], parent: string | null | undefined = undefined): AddFilesActionType {
    return {type: FileIndexActionTypes.ADD_FILES_ACTION, files, parent};
}

interface RemoveFilesActionType extends Action {
    type: FileIndexActionTypes.REMOVE_FILE_ACTION;
    file: DriveMetadata;
}

export function removeFileAction(file: DriveMetadata): RemoveFilesActionType {
    return {type: FileIndexActionTypes.REMOVE_FILE_ACTION, file};
}

export interface UpdateFileActionType extends Action {
    type: FileIndexActionTypes.UPDATE_FILE_ACTION;
    metadata: DriveMetadata;
    peerKey: string| null;
}

export function updateFileAction(metadata: DriveMetadata, peerKey: string | null = null): UpdateFileActionType {
    return {type: FileIndexActionTypes.UPDATE_FILE_ACTION, metadata, peerKey};
}

type FileIndexActionType = AddFilesActionType | RemoveFilesActionType | UpdateFileActionType;

// =========================== Reducers

type DriveMetadataReducerType = {[key: string]: DriveMetadata}

const driveMetadataReducer: Reducer<DriveMetadataReducerType> = (state = {}, action: FileIndexActionType) => {
    switch (action.type) {
        case FileIndexActionTypes.ADD_FILES_ACTION:
            return action.files.reduce((all: DriveMetadataReducerType, file: DriveMetadata) => ({...all, [file.id]: file}), state);
        case FileIndexActionTypes.REMOVE_FILE_ACTION:
            let result = {...state};
            delete(result[action.file.id]);
            return result;
        case FileIndexActionTypes.UPDATE_FILE_ACTION:
            return {...state, [action.metadata.id]: action.metadata};
        default:
            return state;
    }
};

type ChildrenReducerType = {[key: string]: string[]};

const childrenReducer: Reducer<ChildrenReducerType> = (state = {}, action: FileIndexActionType) => {
    switch (action.type) {
        case FileIndexActionTypes.ADD_FILES_ACTION:
            return action.files.reduce((result: ChildrenReducerType, file: DriveMetadata) => {
                file.parents && file.parents.forEach((parent) => {
                    result[parent] = [...(result[parent] || []), file.id];
                });
                return result;
            }, {...state});
        case FileIndexActionTypes.REMOVE_FILE_ACTION:
            let result = {...state};
            delete(result[action.file.id]);
            action.file.parents.forEach((parent: string) => {
                result[parent] = without(result[parent], action.file.id);
            });
            return result;
        default:
            return state;
    }
};

type RootsReducerType = {[key: string]: string};

const rootsReducer: Reducer<RootsReducerType> = (state = {}, action: FileIndexActionType) => {
    if (action.type === FileIndexActionTypes.ADD_FILES_ACTION && (action.parent === null || action.parent === state[constants.FOLDER_ROOT])) {
        // These files are the roots.
        return action.files.reduce((result: RootsReducerType, file: DriveMetadata) => ({...result, [file.name]: file.id}), state);
    } else {
        return state;
    }
};

export interface FileIndexReducerType {
    driveMetadata: DriveMetadataReducerType;
    children: ChildrenReducerType;
    roots: RootsReducerType;
}

const fileIndexReducer = combineReducers<FileIndexReducerType>({
    driveMetadata: driveMetadataReducer,
    children: childrenReducer,
    roots: rootsReducer
});

export default fileIndexReducer;
