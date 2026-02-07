import {AnyAppProperties, AnyProperties, FileMetadata} from '../util/storage/storageContract';
import {Action} from 'redux';

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

export interface AddFilesActionType extends Action {
    type: FileIndexActionTypes.ADD_FILES_ACTION;
    files: FileMetadata[];
}

export interface RemoveFileActionType extends Action {
    type: FileIndexActionTypes.REMOVE_FILE_ACTION;
    fileId: string;
    parents?: string[];
    peerKey: string;
}

export interface UpdateFileActionType<T = AnyAppProperties, U = AnyProperties> extends Action {
    type: FileIndexActionTypes.UPDATE_FILE_ACTION;
    metadata: FileMetadata<T, U>;
    peerKey: string | null;
}

export interface ReplaceFileAction<T = AnyAppProperties, U = AnyProperties> extends Action {
    type: FileIndexActionTypes.REPLACE_FILE_ACTION;
    metadata: FileMetadata<T, U>;
    newMetadata: FileMetadata<T, U>;
    rootFolder: string;
}

export type FileIndexActionType =
    AddRootFilesActionType
    | AddFilesActionType
    | RemoveFileActionType
    | UpdateFileActionType
    | ReplaceFileAction;
export type FileMetadataReducerType = {[key: string]: FileMetadata}
export type ChildrenReducerType = {[key: string]: string[]};
export type RootsReducerType = {[key: string]: string};

export interface FileIndexReducerType {
    fileMetadata: FileMetadataReducerType;
    children: ChildrenReducerType;
    roots: RootsReducerType;
}