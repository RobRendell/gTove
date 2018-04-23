export interface RootDirAppProperties {
    rootFolder: boolean;
}

export interface TabletopFileAppProperties {
    gmFile: string;
}

export interface MapAppProperties {
    width: number;
    height: number;
    gridColour: string;
    gridSize: number;
    gridOffsetX: number;
    gridOffsetY: number;
    fogWidth: number;
    fogHeight: number;
}

export interface DriveMetadata {
    id: string;
    name: string;
    trashed: boolean;
    parents: string[];
    mimeType?: string;
    appProperties?: RootDirAppProperties | TabletopFileAppProperties | MapAppProperties;
    thumbnailLink?: string;
}

export interface DriveUser {
    displayName: string;
    emailAddress: string;
    permissionId: number;
    photoLink?: string;
    offline?: boolean;
}
