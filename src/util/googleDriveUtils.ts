export interface RootDirAppProperties {
    rootFolder: string;
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
    showGrid: boolean;
}

export function castMapAppProperties(mapAppProperties: MapAppProperties): MapAppProperties {
    return (mapAppProperties) ? {
        ...mapAppProperties,
        width: Number(mapAppProperties.width),
        height: Number(mapAppProperties.height),
        gridColour: mapAppProperties.gridColour,
        gridSize: Number(mapAppProperties.gridSize),
        gridOffsetX: Number(mapAppProperties.gridOffsetX),
        gridOffsetY: Number(mapAppProperties.gridOffsetY),
        fogWidth: Number(mapAppProperties.fogWidth),
        fogHeight: Number(mapAppProperties.fogHeight),
        showGrid: String(mapAppProperties.showGrid) === 'true'
    } : mapAppProperties
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
    scale: number;
}

export function castMiniAppProperties(appProperties: MiniAppProperties): MiniAppProperties;
export function castMiniAppProperties(appProperties: TemplateAppProperties): TemplateAppProperties;
export function castMiniAppProperties(appProperties: MiniAppProperties | TemplateAppProperties): MiniAppProperties | TemplateAppProperties;
export function castMiniAppProperties(appProperties: MiniAppProperties | TemplateAppProperties): MiniAppProperties | TemplateAppProperties {
    return (!appProperties) ? appProperties :
        isTemplateAppProperties(appProperties) ? castTemplateAppProperties(appProperties) : {
        ...appProperties,
        width: Number(appProperties.width),
        height: Number(appProperties.height),
        aspectRatio: Number(appProperties.aspectRatio),
        topDownX: Number(appProperties.topDownX),
        topDownY: Number(appProperties.topDownY),
        topDownRadius: Number(appProperties.topDownRadius),
        standeeX: Number(appProperties.standeeX),
        standeeY: Number(appProperties.standeeY),
        standeeRangeX: Number(appProperties.standeeRangeX),
        standeeRangeY: Number(appProperties.standeeRangeY),
        scale: Number(appProperties.scale) || 1
    };
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
        ...appProperties,
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

export type AnyAppProperties = RootDirAppProperties | TabletopFileAppProperties | MapAppProperties | MiniAppProperties | DriveFileShortcut | FromBundleAppProperties | WebLinkAppProperties | undefined;

export interface DriveMetadata<T = AnyAppProperties> {
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

export function anyAppPropertiesTooLong(appProperties: AnyAppProperties): boolean {
    return !appProperties ? false :
        Object.keys(appProperties).reduce((result, key) => (result || key.length + appProperties[key].length > 124), false);
}