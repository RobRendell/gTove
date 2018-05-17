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

export interface MiniAppProperties {
    width: number;
    height: number;
    aspectRatio: number;
    topDownX: number;
    topDownY: number;
    topDownRadius: number;
}

export interface DriveMetadata<T = RootDirAppProperties | TabletopFileAppProperties | MapAppProperties | MiniAppProperties | undefined> {
    id: string;
    name: string;
    trashed: boolean;
    parents: string[];
    mimeType?: string;
    appProperties: T;
    thumbnailLink?: string;
}

export interface DriveUser {
    displayName: string;
    emailAddress: string;
    permissionId: number;
    photoLink?: string;
    offline?: boolean;
}
