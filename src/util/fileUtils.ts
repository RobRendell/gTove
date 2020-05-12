import {AnyAction} from 'redux';
import {ThunkDispatch} from 'redux-thunk';

import {updateFileAction} from '../redux/fileIndexReducer';
import {
    DriveMetadata,
    DriveUser,
    isTabletopFileMetadata
} from './googleDriveUtils';
import {ReduxStoreType} from '../redux/mainReducer';

export type AddFilesCallback = (files: DriveMetadata[]) => void;

export interface OnProgressParams {
    loaded: number;
    total: number;
}

export interface FileAPIContext {
    fileAPI: FileAPI;
}

export interface FileAPI {
    initialiseFileAPI: (callback: (signedIn: boolean) => void, onError: (error: Error) => void) => void;
    signInToFileAPI: () => void;
    signOutFromFileAPI: () => void;
    getLoggedInUserInfo: () => Promise<DriveUser>;
    loadRootFiles: (addFilesCallback: AddFilesCallback) => Promise<void>;
    loadFilesInFolder: (id: string, addFilesCallback: AddFilesCallback) => Promise<void>;
    getFullMetadata: (id: string) => Promise<DriveMetadata>;
    getFileModifiedTime: (id: string) => Promise<number>;
    createFolder: (folderName: string, metadata?: Partial<DriveMetadata>) => Promise<DriveMetadata>;
    uploadFile: (driveMetadata: Partial<DriveMetadata>, file: Blob, onProgress?: (progress: OnProgressParams) => void) => Promise<DriveMetadata>;
    saveJsonToFile: (idOrMetadata: string | Partial<DriveMetadata>, json: object) => Promise<DriveMetadata>;
    uploadFileMetadata: (metadata: Partial<DriveMetadata>, addParents?: string) => Promise<DriveMetadata>;
    createShortcut: (originalFile: Partial<DriveMetadata> & {id: string}, newParents: string[]) => Promise<DriveMetadata>;
    getFileContents: (metadata: Partial<DriveMetadata>) => Promise<Blob>;
    getJsonFileContents: (metadata: Partial<DriveMetadata>) => Promise<any>;
    makeFileReadableToAll: (metadata: Partial<DriveMetadata>) => Promise<void>;
    findFilesWithAppProperty: (key: string, value: string) => Promise<DriveMetadata[]>;
    findFilesWithProperty: (key: string, value: string) => Promise<DriveMetadata[]>;
    findFilesContainingNameWithProperty: (name: string, key: string, value: string) => Promise<DriveMetadata[]>;
    deleteFile: (metadata: Partial<DriveMetadata>) => Promise<Partial<DriveMetadata>>;
}

export async function updateFileMetadataAndDispatch(fileAPI: FileAPI, metadata: Partial<DriveMetadata>, dispatch: ThunkDispatch<ReduxStoreType, {}, AnyAction>, transmit: boolean = false): Promise<DriveMetadata> {
    let driveMetadata = await fileAPI.uploadFileMetadata(metadata);
    if (isTabletopFileMetadata(driveMetadata)) {
        // If there's an associated gmFile, update it as well
        dispatch(updateFileAction(driveMetadata, transmit ? driveMetadata.id : undefined));
        driveMetadata = await fileAPI.uploadFileMetadata({...metadata, id: driveMetadata.appProperties.gmFile});
    }
    dispatch(updateFileAction(driveMetadata, transmit ? driveMetadata.id : undefined));
    return driveMetadata;
}

export function splitFileName(fileName: string): {name: string, suffix: string} {
    const match = fileName.match(/^(.*)(\.[a-zA-Z0-9]*)$/);
    if (match) {
        return {name: match[1] || '', suffix: match[2] || ''};
    } else {
        return {name: fileName, suffix: ''};
    }
}

// CORS proxy for web link maps and minis
const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';

export function corsUrl(url: string) {
    return (url[0] === '/') ? url : CORS_PROXY + url;
}

export function isSupportedVideoMimeType(mimeType?: string) {
    return (mimeType === 'video/mp4' || mimeType === 'video/webm');
}