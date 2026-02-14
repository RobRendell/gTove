import {EntityState} from '@reduxjs/toolkit';

import {FileMetadata} from '../util/storage/storageContract';

/**
 * It's not recommended to store non-serializable objects like File in the redux store, but these are short-lived
 * objects which are just used to maintain the state of an ongoing multi-file upload while the user does other things.
 */
export type UploadPlaceholderType = {
    metadata: FileMetadata;
    rootFolder: string;
    file?: File;
    directoryDepth: number;
    progress: number;
    targetProgress: number;
    upload: boolean;
    deleted?: boolean;
}

export type UploadPlaceholderReducerType = EntityState<UploadPlaceholderType, string> & {
    uploading: boolean;
    singleMetadata: null | undefined | FileMetadata;
};