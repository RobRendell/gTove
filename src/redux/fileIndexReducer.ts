import {Action, combineReducers, Reducer} from 'redux';
import {without} from 'lodash';

import {DriveMetadata} from '../util/googleDriveUtils';

// =========================== Action types and generators

export enum FileIndexActionTypes {
    ADD_FILES_ACTION = 'add-files-action',
    ADD_ROOT_FILES_ACTION = 'add-root-files-action',
    REMOVE_FILE_ACTION = 'remove-file-action',
    UPDATE_FILE_ACTION = 'update-file-action'
}

interface AddFilesActionType extends Action {
    type: FileIndexActionTypes.ADD_FILES_ACTION | FileIndexActionTypes.ADD_ROOT_FILES_ACTION;
    files: DriveMetadata[];
}

export function addFilesAction(files: DriveMetadata[]): AddFilesActionType {
    return {type: FileIndexActionTypes.ADD_FILES_ACTION, files};
}

export function addRootFilesAction(files: DriveMetadata[]): AddFilesActionType {
    return {type: FileIndexActionTypes.ADD_ROOT_FILES_ACTION, files};
}

export interface RemoveFilesActionType extends Action {
    type: FileIndexActionTypes.REMOVE_FILE_ACTION;
    file: {id: string} & Partial<DriveMetadata>;
    peerKey: string;
}

export function removeFileAction(file: {id: string} & Partial<DriveMetadata>): RemoveFilesActionType {
    return {type: FileIndexActionTypes.REMOVE_FILE_ACTION, file, peerKey: file.id};
}

export interface UpdateFileActionType extends Action {
    type: FileIndexActionTypes.UPDATE_FILE_ACTION;
    metadata: DriveMetadata;
    peerKey: string | null;
}

export function updateFileAction(metadata: DriveMetadata, peerKey: string | null = null): UpdateFileActionType {
    return {type: FileIndexActionTypes.UPDATE_FILE_ACTION, metadata, peerKey};
}

export function setFetchingFileAction(metadataId: string) {
    return {type: FileIndexActionTypes.UPDATE_FILE_ACTION, metadata: {id: metadataId}};
}

export const ERROR_FILE_NAME = 'image error';
export function setFileErrorAction(metadataId: string) {
    return {type: FileIndexActionTypes.UPDATE_FILE_ACTION, metadata: {id: metadataId, name: ERROR_FILE_NAME, appProperties: {width: 1, height: 1}}};
}

export function setFileContinueAction(metadataId: string) {
    return {type: FileIndexActionTypes.UPDATE_FILE_ACTION, metadata: {id: metadataId, name: 'missing image', appProperties: {width: 1, height: 1}}};
}

type FileIndexActionType = AddFilesActionType | RemoveFilesActionType | UpdateFileActionType;

// =========================== Reducers

type DriveMetadataReducerType = {[key: string]: DriveMetadata}

const driveMetadataReducer: Reducer<DriveMetadataReducerType> = (state = {}, action: FileIndexActionType) => {
    switch (action.type) {
        case FileIndexActionTypes.ADD_FILES_ACTION:
        case FileIndexActionTypes.ADD_ROOT_FILES_ACTION:
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
        case FileIndexActionTypes.ADD_ROOT_FILES_ACTION:
            return action.files.reduce((result: ChildrenReducerType, file: DriveMetadata) => {
                file.parents && file.parents.forEach((parent) => {
                    const previous = result[parent] || [];
                    if (previous.indexOf(file.id) < 0) {
                        result[parent] = [...previous, file.id];
                    }
                });
                return result;
            }, {...state});
        case FileIndexActionTypes.REMOVE_FILE_ACTION:
            let result = {...state};
            delete(result[action.file.id]);
            action.file.parents && action.file.parents.forEach((parent: string) => {
                result[parent] = without(result[parent], action.file.id);
            });
            return result;
        default:
            return state;
    }
};

type RootsReducerType = {[key: string]: string};

const rootsReducer: Reducer<RootsReducerType> = (state = {}, action: FileIndexActionType) => {
    switch (action.type) {
        case FileIndexActionTypes.ADD_ROOT_FILES_ACTION:
            return action.files.reduce((result: RootsReducerType, file: DriveMetadata) => ({...result, [file.name]: file.id}), state);
        default:
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
