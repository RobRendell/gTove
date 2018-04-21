export interface RootDirAppProperties {
    rootFolder: boolean;
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
    mimeType: string;
    appProperties?: RootDirAppProperties | MapAppProperties;
    thumbnailLink?: string;
    trashed: boolean;
    parents: string[];
}

export interface User {
}
