import { FOLDER_MAP, FOLDER_MINI, MINI_HEIGHT } from "../constants";
import { DistanceMode, DistanceRound } from "../scenarioUtils";

export type AddFilesCallback = (files: FileMetadata[]) => void;


export interface FileAPIContext {
    fileAPI: FileAPI;
}

export interface FileAPI {
    initialiseFileAPI: (callback: (signedIn: boolean) => void, onError: (error: Error) => void) => void;
    signInToFileAPI: () => void;
    signOutFromFileAPI: () => void;
    getLoggedInUserInfo: () => Promise<FileSystemUser>;
    loadRootFiles: (addFilesCallback: AddFilesCallback) => Promise<void>;
    loadFilesInFolder: (id: string, addFilesCallback: AddFilesCallback) => Promise<void>;
    getFullMetadata: (id: string, accessKey?: string) => Promise<FileMetadata>;
    getFileModifiedTime: (id: string) => Promise<number>;
    createFolder: (folderName: string, metadata?: Partial<FileMetadata>) => Promise<FileMetadata>;
    uploadFile: (metadata: Partial<FileMetadata>, file: Blob, onProgress?: (progress: OnProgressParams) => void) => Promise<FileMetadata>;
    saveJsonToFile: (idOrMetadata: string | Partial<FileMetadata>, json: object) => Promise<FileMetadata>;
    uploadFileMetadata: (metadata: Partial<FileMetadata>, addParents?: string[], removeParents?: string[]) => Promise<FileMetadata>;
    createShortcut: (originalFile: Partial<FileMetadata> & {id: string}, newParents: string[]) => Promise<FileMetadata>;
    getFileContents: (metadata: Partial<FileMetadata>) => Promise<Blob>;
    getJsonFileContents: (metadata: Partial<FileMetadata>) => Promise<any>;
    makeFileReadableToAll: (metadata: Partial<FileMetadata>) => Promise<void>;
    findFilesWithAppProperty: (key: string, value: string) => Promise<FileMetadata[]>;
    findFilesWithProperty: (key: string, value: string) => Promise<FileMetadata[]>;
    findFilesContainingNameWithProperty: (name: string, key: string, value: string) => Promise<FileMetadata[]>;
    deleteFile: (metadata: Partial<FileMetadata>) => Promise<void>;
}




export interface OnProgressParams {
    loaded: number;
    total: number;
}

export interface FileSystemUser {
    displayName: string;
    emailAddress: string;
    permissionId: string;
    photoLink?: string;
    icon?: string;
    offline?: boolean;
    me?: boolean;
}

export enum GridType {
    NONE = 'NONE',
    SQUARE = 'SQUARE',
    HEX_VERT = 'HEX_VERT',
    HEX_HORZ = 'HEX_HORZ'
}
export interface WebLinkProperties {
    webLink?: string;
}

export enum TemplateShape {
    RECTANGLE = 'RECTANGLE',
    CIRCLE = 'CIRCLE',
    ARC = 'ARC',
    ICON = 'ICON'
}

export enum IconShapeEnum {
    comment = 'comment',
    account_balance = 'account_balance',
    home = 'home',
    lock = 'lock',
    lock_open = 'lock_open',
    build = 'build',
    star = 'star',
    place = 'place',
    cloud = 'cloud',
    brightness_2 = 'brightness_2',
    brightness_5 = 'brightness_5',
    assistant_photo = 'assistant_photo',
    close = 'close'
}

export enum PieceVisibilityEnum {
    HIDDEN = 1, FOGGED = 2, REVEALED = 3
}

export interface TemplateProperties extends TabletopObjectProperties, FromBundleProperties {
    templateShape: TemplateShape;
    colour: number;
    opacity: number;
    width: number;
    height: number;
    depth: number;
    angle?: number;
    offsetX: number;
    offsetY: number;
    offsetZ: number;
    defaultVisibility: PieceVisibilityEnum;
    iconShape?: IconShapeEnum;
}

export type ScenarioObjectProperties = MapProperties | MiniProperties | TemplateProperties;



export interface MapProperties extends TabletopObjectProperties, FromBundleProperties, WebLinkProperties {
    width: number;
    height: number;
    gridType: GridType;
    gridColour: string;
    gridSize: number;
    gridHeight?: number;
    gridOffsetX: number;
    gridOffsetY: number;
    fogWidth: number;
    fogHeight: number;
    showGrid: boolean;
    gridScale?: number;
    gridUnit?: string;
    distanceMode?: DistanceMode;
    distanceRound?: DistanceRound;
}


export interface MiniProperties extends TabletopObjectProperties, FromBundleProperties, WebLinkProperties {
    width: number;
    height: number;
    aspectRatio: number;
    topDownX: number;
    topDownY: number;
    topDownRadius: number;
    standeeX: number;
    standeeY: number;
    standeeRangeX: number;
    standeeRangeY: number;
    scale: number;
    colour?: string;
    defaultVisibility: PieceVisibilityEnum;
}

export const defaultMiniProperties: MiniProperties = {
    rootFolder: FOLDER_MINI,
    width: 0,
    height: 0,
    aspectRatio: 1,
    topDownX: 0.5,
    topDownY: 0.5,
    topDownRadius: 0.5,
    standeeX: 0.5,
    standeeY: 0,
    standeeRangeX: +MINI_HEIGHT,
    standeeRangeY: MINI_HEIGHT,
    scale: 1,
    defaultVisibility: PieceVisibilityEnum.FOGGED
};

export const defaultMapProperties: MapProperties = {
    rootFolder: FOLDER_MAP,
    width: 0,
    height: 0,
    gridType: GridType.NONE,
    gridColour: GridType.NONE,
    gridSize: 32,
    gridOffsetX: 32,
    gridOffsetY: 32,
    fogWidth: 0,
    fogHeight: 0,
    showGrid: false
};

export interface FromBundleProperties {
    fromBundleId?: string;
    pageCrop?: {
        pdfMetadataId: string;
        page: number;
        rotation: number;
        top: number;
        left: number;
    }
}

export interface RootDirAppProperties {
    rootFolder: string;
    dataVersion: string;
}

export interface TabletopObjectProperties {
    rootFolder: string;
}

export interface TabletopFileAppProperties {
    gmFile: string;
}

export interface FileShortcut extends FromBundleProperties {
    shortcutMetadataId: string; // The metadataId of the original file this shortcut points to.
    ownedMetadataId: string; // The metadataId of the shortcut file itself.
}


export type AnyAppProperties = RootDirAppProperties | TabletopFileAppProperties | void;

export type AnyProperties = MiniProperties 
    | ScenarioObjectProperties 
    | FromBundleProperties 
    | WebLinkProperties 
    | FileShortcut 
    | TemplateProperties
    | void;

export interface FileMetadata<appPropT = AnyAppProperties, propT = AnyProperties> {
    id: string;
    name: string;
    trashed: boolean;
    parents: string[];
    mimeType?: string;
    thumbnailLink?: string;
    owners?: FileSystemUser[];
    resourceKey?: string;

    // Abstract storage for provider-specific metadata
    appData?: Record<string, any>;
    appProperties?: appPropT;
    properties?: propT;
    
    // Abstract storage for custom properties
    customProperties?: Record<string, any>;
}
