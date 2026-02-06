import {Action, combineReducers} from 'redux';
import {omit, without} from 'lodash';

import {buildTutorialMetadata} from '../tutorial/tutorialUtils';
import { AnyAppProperties, AnyProperties, FileMetadata } from '../util/storage/storageContract';

// =========================== Action types and generators

export enum FileIndexActionTypes {
    ADD_FILES_ACTION = 'add-files-action',
    ADD_ROOT_FILES_ACTION = 'add-root-files-action',
    REMOVE_FILE_ACTION = 'remove-file-action',
    UPDATE_FILE_ACTION = 'update-file-action',
    REPLACE_FILE_ACTION = 'replace-file-action'
}

export interface AddRootFilesActionType extends Action {
    type: FileIndexActionTypes.ADD_ROOT_FILES_ACTION;
    files: FileMetadata[];
}

interface AddFilesActionType extends Action {
    type: FileIndexActionTypes.ADD_FILES_ACTION;
    files: FileMetadata[];
}

export function addFilesAction(files: FileMetadata[]): AddFilesActionType {
    return {type: FileIndexActionTypes.ADD_FILES_ACTION, files};
}

export function addRootFilesAction(files: FileMetadata[]): AddRootFilesActionType {
    return {type: FileIndexActionTypes.ADD_ROOT_FILES_ACTION, files};
}

export interface RemoveFileActionType extends Action {
    type: FileIndexActionTypes.REMOVE_FILE_ACTION;
    fileId: string;
    parents?: string[];
    peerKey: string;
}

export function removeFileAction(file: {id: string} & Partial<FileMetadata>): RemoveFileActionType {
    return {type: FileIndexActionTypes.REMOVE_FILE_ACTION, fileId: file.id, parents: file.parents, peerKey: file.id};
}

export interface UpdateFileActionType<T = AnyAppProperties, U = AnyProperties> extends Action {
    type: FileIndexActionTypes.UPDATE_FILE_ACTION;
    metadata: FileMetadata<T, U>;
    peerKey: string | null;
}

export function updateFileAction(metadata: FileMetadata, peerKey: string | null = null): UpdateFileActionType {
    return {type: FileIndexActionTypes.UPDATE_FILE_ACTION, metadata, peerKey};
}

export interface ReplaceFileAction<T = AnyAppProperties, U = AnyProperties> extends Action {
    type: FileIndexActionTypes.REPLACE_FILE_ACTION;
    metadata: FileMetadata<T, U>;
    newMetadata: FileMetadata<T, U>;
    rootFolder: string;
}

export function replaceFileAction(metadata: FileMetadata, newMetadata: FileMetadata, rootFolder: string): ReplaceFileAction {
    return {type: FileIndexActionTypes.REPLACE_FILE_ACTION, metadata, newMetadata, rootFolder};
}

export const ERROR_FILE_NAME = 'image error';
export function setFileErrorAction(metadataId: string) {
    return {type: FileIndexActionTypes.UPDATE_FILE_ACTION, metadata: {id: metadataId, name: ERROR_FILE_NAME, properties: {width: 1, height: 1}, parents: []}};
}

export function setFileContinueAction(metadataId: string) {
    return {type: FileIndexActionTypes.UPDATE_FILE_ACTION, metadata: {id: metadataId, name: 'missing image', properties: {width: 1, height: 1}, parents: []}};
}

type FileIndexActionType = AddRootFilesActionType | AddFilesActionType | RemoveFileActionType | UpdateFileActionType | ReplaceFileAction;

// =========================== Reducers

type FileMetadataReducerType = {[key: string]: FileMetadata}

function driveMetadataReducer(state: FileMetadataReducerType = buildTutorialMetadata(), action: FileIndexActionType) {
    switch (action.type) {
        case FileIndexActionTypes.ADD_FILES_ACTION:
        case FileIndexActionTypes.ADD_ROOT_FILES_ACTION:
            return action.files.reduce((all: FileMetadataReducerType, file: FileMetadata) => ({...all, [file.id]: file}), state);
        case FileIndexActionTypes.REMOVE_FILE_ACTION:
            return omit(state, action.fileId);
        case FileIndexActionTypes.UPDATE_FILE_ACTION:
            return {...state, [action.metadata.id]: action.metadata};
        case FileIndexActionTypes.REPLACE_FILE_ACTION:
            const childrenIds = Object.keys(state).filter((id) => (state[id].parents.indexOf(action.metadata.id) >= 0));
            return {
                ...omit(state, action.metadata.id),
                [action.newMetadata.id]: action.newMetadata,
                ...childrenIds.reduce((children:any, id) => {
                    children[id] = {...state[id], parents: state[id].parents.map((parentId) => (parentId === action.metadata.id ? action.newMetadata.id : parentId))}
                    return children;
                }, {})
            };
        default:
            return state;
    }
}

type ChildrenReducerType = {[key: string]: string[]};

function childrenReducer(state: ChildrenReducerType = {}, action: FileIndexActionType) {
    switch (action.type) {
        case FileIndexActionTypes.ADD_FILES_ACTION:
        case FileIndexActionTypes.ADD_ROOT_FILES_ACTION:
            return action.files.reduce((result: ChildrenReducerType, file: FileMetadata) => {
                file.parents && file.parents.forEach((parent) => {
                    const previous = result[parent] || [];
                    if (previous.indexOf(file.id) < 0) {
                        result[parent] = [...previous, file.id];
                    }
                });
                return result;
            }, {...state});
        case FileIndexActionTypes.UPDATE_FILE_ACTION:
            return (action.metadata.parents || []).reduce<ChildrenReducerType | undefined>((nextState, parentId) => {
                if (!state[parentId] || state[parentId].indexOf(action.metadata.id) < 0) {
                    nextState = nextState || {...state};
                    const previous = nextState[parentId] || [];
                    nextState[parentId] = [...previous, action.metadata.id];
                }
                return nextState;
            }, undefined) || state;
        case FileIndexActionTypes.REMOVE_FILE_ACTION:
            let result = {...state};
            delete(result[action.fileId]);
            action.parents?.forEach((parent: string) => {
                result[parent] = without(result[parent], action.fileId);
            });
            return result;
        case FileIndexActionTypes.REPLACE_FILE_ACTION:
            return {
                ...omit(state, action.metadata.id),
                [action.newMetadata.id]: state[action.metadata.id],
                ...action.newMetadata.parents.reduce((all:any, id) => {
                    const previous = without(state[id] || [], action.metadata.id);
                    if (previous.indexOf(action.newMetadata.id) < 0) {
                        all[id] = [...previous, action.newMetadata.id]
                    }
                    return all;
                }, {})
            };
        default:
            return state;
    }
}

type RootsReducerType = {[key: string]: string};

function rootsReducer(state: RootsReducerType = {}, action: FileIndexActionType) {
    switch (action.type) {
        case FileIndexActionTypes.ADD_ROOT_FILES_ACTION:
            return action.files.reduce((result: RootsReducerType, file: FileMetadata) => ({...result, [file.name]: file.id}), state);
        default:
            return state;
    }
}

export interface FileIndexReducerType {
    fileMetadata: FileMetadataReducerType;
    children: ChildrenReducerType;
    roots: RootsReducerType;
}

const combinedFileIndexReducer = combineReducers<FileIndexReducerType>({
    fileMetadata: driveMetadataReducer,
    children: childrenReducer,
    roots: rootsReducer
});

export default function fileIndexReducer(state: FileIndexReducerType | undefined, action: FileIndexActionType): FileIndexReducerType {
    let nextState = combinedFileIndexReducer(state, action);
    // Special handling is required if we remove a file from a directory, since we can only detect if from up here.
    if (action.type === FileIndexActionTypes.UPDATE_FILE_ACTION) {
        const id = action.metadata.id;
        if (state && state.fileMetadata[id] && nextState.fileMetadata[id] && state.fileMetadata[id].parents !== nextState.fileMetadata[id].parents) {
            const removedParents = without(state.fileMetadata[id].parents, ...nextState.fileMetadata[id].parents);
            if (removedParents.length > 0) {
                const children = {...nextState.children};
                for (let removedParentId of removedParents) {
                    children[removedParentId] = without(children[removedParentId], id);
                }
                nextState = {...nextState, children}
            }
        }
    }
    return nextState;
}
