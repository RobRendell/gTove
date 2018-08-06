export interface RootDirAppProperties {
    rootFolder: boolean;
}

export interface TabletopFileAppProperties {
    gmFile: string;
}

export interface FromBundleAppProperties {
    fromBundleId?: string;
}

export interface WebLinkAppProperties {
    webLink?: string;
}

export interface MapAppProperties extends FromBundleAppProperties, WebLinkAppProperties {
    width: number;
    height: number;
    gridColour: string;
    gridSize: number;
    gridOffsetX: number;
    gridOffsetY: number;
    fogWidth: number;
    fogHeight: number;
}

export interface MiniAppProperties extends FromBundleAppProperties, WebLinkAppProperties {
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

export enum TemplateShape {
    RECTANGLE = 'RECTANGLE',
    CIRCLE = 'CIRCLE',
    ARC = 'ARC'
}

export interface TemplateAppProperties extends FromBundleAppProperties {
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
}

export function castTemplateAppProperties(appProperties: TemplateAppProperties): TemplateAppProperties {
    return (appProperties) ? {
        templateShape: appProperties.templateShape,
        colour: Number(appProperties.colour),
        opacity: Number(appProperties.opacity),
        width: Number(appProperties.width),
        height: Number(appProperties.height),
        depth: Number(appProperties.depth),
        angle: Number(appProperties.angle),
        offsetX: Number(appProperties.offsetX),
        offsetY: Number(appProperties.offsetY),
        offsetZ: Number(appProperties.offsetZ)
    } : {
        templateShape: TemplateShape.RECTANGLE,
        colour: 0x00ff00,
        opacity: 0.5,
        width: 1,
        height: 0,
        depth: 1,
        angle: 60,
        offsetX: 0,
        offsetY: 0,
        offsetZ: 0,
    }
}

export type TabletopObjectAppProperties = MapAppProperties | MiniAppProperties | TemplateAppProperties;

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

export interface DriveMetadata<T = RootDirAppProperties | TabletopFileAppProperties | MapAppProperties | MiniAppProperties | DriveFileShortcut | FromBundleAppProperties | WebLinkAppProperties | undefined> {
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

export function isWebLinkAppProperties(appProperties: any): appProperties is WebLinkAppProperties {
    return appProperties && appProperties.webLink !== undefined;
}

export function isTemplateAppProperties(appProperties: any): appProperties is TemplateAppProperties {
    return appProperties && appProperties.templateShape !== undefined;
}

export function isTemplateMetadata(metadata: any): metadata is DriveMetadata<TemplateAppProperties> {
    return metadata && isTemplateAppProperties(metadata.appProperties);
}

export function isMiniAppProperties(appProperties: any): appProperties is MiniAppProperties {
    return appProperties && !isTemplateAppProperties(appProperties);
}

export function isMiniMetadata(metadata: any): metadata is DriveMetadata<MiniAppProperties> {
    return metadata && isMiniAppProperties(metadata.appProperties);
}