import {Dispatch} from 'redux';

import {updateFileAction} from '../redux/fileIndexReducer';
import {DriveMetadata, DriveUser, TabletopFileAppProperties} from './googleDriveUtils';
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
    loadFilesInFolder: (id: string, addFilesCallback: AddFilesCallback, pageToken?: string) => Promise<void>;
    getFullMetadata: (id: string) => Promise<DriveMetadata>;
    getFileModifiedTime: (id: string) => Promise<number>;
    createFolder: (folderName: string, metadata?: Partial<DriveMetadata>) => Promise<DriveMetadata>;
    uploadFile: (driveMetadata: Partial<DriveMetadata>, file: Blob, onProgress?: (progress: OnProgressParams) => void) => Promise<DriveMetadata>;
    saveJsonToFile: (idOrMetadata: string | Partial<DriveMetadata>, json: object) => Promise<DriveMetadata>;
    uploadFileMetadata: (metadata: Partial<DriveMetadata>, addParents?: string) => Promise<DriveMetadata>;
    createShortcut: (originalFile: Partial<DriveMetadata>, newParent: string) => Promise<DriveMetadata>;
    getFileContents: (metadata: Partial<DriveMetadata>) => Promise<object>;
    getJsonFileContents: (metadata: Partial<DriveMetadata>) => Promise<object>;
    makeFileReadableToAll: (metadata: Partial<DriveMetadata>) => Promise<void>;
    findFilesWithAppProperty: (key: string, value: string) => Promise<DriveMetadata[]>;
}

export function updateFileMetadataAndDispatch(fileAPI: FileAPI, metadata: Partial<DriveMetadata>, dispatch: Dispatch<ReduxStoreType>, transmit: boolean = false): Promise<DriveMetadata> {
    return fileAPI.uploadFileMetadata(metadata)
        .then((driveMetadata) => {
            if (driveMetadata.appProperties && (<TabletopFileAppProperties>driveMetadata.appProperties).gmFile) {
                // If there's an associated gmFile, update it as well
                dispatch(updateFileAction(driveMetadata, transmit ? driveMetadata.id : undefined));
                return fileAPI.uploadFileMetadata({...metadata, id: (<TabletopFileAppProperties>driveMetadata.appProperties).gmFile});
            } else {
                return driveMetadata;
            }
        })
        .then((driveMetadata) => {
            dispatch(updateFileAction(driveMetadata, transmit ? driveMetadata.id : undefined));
            return driveMetadata;
        });
}

export function splitFileName(fileName: string): {name: string, suffix: string} {
    const match = fileName.match(/^(.*)(\.[a-zA-Z]*)?$/);
    if (match) {
        return {name: match[1] || '', suffix: match[2] || ''};
    } else {
        return {name: '', suffix: ''};
    }
}