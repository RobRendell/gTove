export interface RootDirAppProperties {
    rootFolder: boolean;
}

export interface TabletopFileAppProperties {
    gmFile: string;
}

export interface FromBundleAppProperties {
    fromBundleId?: string;
}

export interface MapAppProperties extends FromBundleAppProperties {
    width: number;
    height: number;
    gridColour: string;
    gridSize: number;
    gridOffsetX: number;
    gridOffsetY: number;
    fogWidth: number;
    fogHeight: number;
}

export interface MiniAppProperties extends FromBundleAppProperties {
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
}

export interface DriveFileShortcut extends FromBundleAppProperties {
    shortcutMetadataId: string;
}

export function isDriveFileShortcut(appProperties: any): appProperties is DriveFileShortcut {
    return appProperties.shortcutMetadataId !== undefined;
}

export interface DriveFileOwner {
    kind: 'drive#user';
    displayName: string;
    photoLink: string;
    me: boolean;
    permissionId: string;
    emailAddress: string;
}

export interface DriveMetadata<T = RootDirAppProperties | TabletopFileAppProperties | MapAppProperties | MiniAppProperties | DriveFileShortcut | FromBundleAppProperties | undefined> {
    id: string;
    name: string;
    trashed: boolean;
    parents: string[];
    mimeType?: string;
    appProperties: T;
    thumbnailLink?: string;
    owners?: DriveFileOwner[];
}

export interface DriveUser {
    displayName: string;
    emailAddress: string;
    permissionId: number;
    photoLink?: string;
    offline?: boolean;
}
