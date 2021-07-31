import {FOLDER_TEMPLATE, GRID_NONE} from './constants';
import {PieceVisibilityEnum} from './scenarioUtils';

export interface RootDirAppProperties {
    rootFolder: string;
    dataVersion: string;
}

export interface TabletopFileAppProperties {
    gmFile: string;
}

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

export interface WebLinkProperties {
    webLink?: string;
}

export interface TabletopObjectProperties {
    rootFolder: string;
}

export enum GridType {
    NONE = 'NONE',
    SQUARE = 'SQUARE',
    HEX_VERT = 'HEX_VERT',
    HEX_HORZ = 'HEX_HORZ'
}

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
}

export function castMapProperties(properties: MapProperties): MapProperties {
    const gridColour = (properties && properties.gridColour) || GRID_NONE;
    return (properties) ? {
        ...properties,
        width: Number(properties.width),
        height: Number(properties.height),
        gridType: properties.gridType ? properties.gridType :
            gridColour === GRID_NONE ? GridType.NONE : GridType.SQUARE,
        gridColour,
        gridSize: Number(properties.gridSize),
        gridHeight: properties.gridHeight ? Number(properties.gridHeight) : undefined,
        gridOffsetX: Number(properties.gridOffsetX),
        gridOffsetY: Number(properties.gridOffsetY),
        fogWidth: Number(properties.fogWidth),
        fogHeight: Number(properties.fogHeight),
        showGrid: String(properties.showGrid) === 'true',
        pageCrop: typeof(properties.pageCrop) === 'string' ? JSON.parse(properties.pageCrop) : properties.pageCrop
    } : properties
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

export function castMiniProperties(properties: MiniProperties): MiniProperties;
export function castMiniProperties(properties: TemplateProperties): TemplateProperties;
export function castMiniProperties(properties: MiniProperties | TemplateProperties): MiniProperties | TemplateProperties;
export function castMiniProperties(properties: MiniProperties | TemplateProperties): MiniProperties | TemplateProperties {
    return (!properties) ? properties :
        isTemplateProperties(properties) ? castTemplateProperties(properties) : {
        ...properties,
        width: Number(properties.width),
        height: Number(properties.height),
        aspectRatio: Number(properties.aspectRatio),
        topDownX: Number(properties.topDownX),
        topDownY: Number(properties.topDownY),
        topDownRadius: Number(properties.topDownRadius),
        standeeX: Number(properties.standeeX),
        standeeY: Number(properties.standeeY),
        standeeRangeX: Number(properties.standeeRangeX),
        standeeRangeY: Number(properties.standeeRangeY),
        scale: Number(properties.scale) || 1,
        defaultVisibility: properties.defaultVisibility === undefined ? PieceVisibilityEnum.FOGGED : Number(properties.defaultVisibility),
        pageCrop: typeof(properties.pageCrop) === 'string' ? JSON.parse(properties.pageCrop) : properties.pageCrop
    };
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

export function castTemplateProperties(properties: TemplateProperties): TemplateProperties {
    return (properties) ? {
        ...properties,
        colour: Number(properties.colour),
        opacity: Number(properties.opacity),
        width: Number(properties.width),
        height: Number(properties.height),
        depth: Number(properties.depth),
        angle: Number(properties.angle),
        offsetX: Number(properties.offsetX),
        offsetY: Number(properties.offsetY),
        offsetZ: Number(properties.offsetZ),
        defaultVisibility: properties.defaultVisibility === undefined ? PieceVisibilityEnum.FOGGED : Number(properties.defaultVisibility)
    } : {
        rootFolder: FOLDER_TEMPLATE,
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
        defaultVisibility: PieceVisibilityEnum.FOGGED
    }
}

export type ScenarioObjectProperties = MapProperties | MiniProperties | TemplateProperties;

export interface DriveFileShortcut extends FromBundleProperties {
    shortcutMetadataId: string;
    ownedMetadataId: string;
}

export function isDriveFileShortcut(metadata: any): metadata is DriveMetadata<void, DriveFileShortcut> {
    return metadata.properties && metadata.properties.shortcutMetadataId !== undefined;
}

export interface DriveFileOwner {
    kind: 'drive#user';
    displayName: string;
    photoLink: string;
    me: boolean;
    permissionId: string;
    emailAddress: string;
}

export type AnyAppProperties = RootDirAppProperties | TabletopFileAppProperties | void;

export type AnyProperties = ScenarioObjectProperties | DriveFileShortcut | FromBundleProperties | WebLinkProperties | void;

export interface DriveMetadata<T = AnyAppProperties, U = AnyProperties> {
    id: string;
    name: string;
    trashed: boolean;
    parents: string[];
    mimeType?: string;
    appProperties: T;
    properties: U;
    thumbnailLink?: string;
    owners?: DriveFileOwner[];
}

export interface DriveUser {
    displayName: string;
    emailAddress: string;
    permissionId: string;
    photoLink?: string;
    icon?: string;
    offline?: boolean;
}

export function isTabletopFileAppProperties(appProperties: any): appProperties is TabletopFileAppProperties {
    return appProperties && appProperties.gmFile !== undefined;
}

export function isTabletopFileMetadata(metadata: any): metadata is DriveMetadata<TabletopFileAppProperties, void> {
    return metadata && isTabletopFileAppProperties(metadata.appProperties);
}

export function isWebLinkProperties(properties: any): properties is WebLinkProperties {
    return properties && properties.webLink !== undefined;
}

export function isTemplateProperties(properties: any): properties is TemplateProperties {
    return properties && properties.templateShape !== undefined;
}

export function isTemplateMetadata(metadata: any): metadata is DriveMetadata<void, TemplateProperties> {
    return metadata && isTemplateProperties(metadata.properties);
}

export function isMiniProperties(properties: any): properties is MiniProperties {
    return properties && !isTemplateProperties(properties);
}

export function isMiniMetadata(metadata: any): metadata is DriveMetadata<void, MiniProperties> {
    return metadata && isMiniProperties(metadata.properties);
}

export function anyPropertiesTooLong(properties: AnyAppProperties | AnyProperties): boolean {
    return !properties ? false :
        Object.keys(properties).reduce<boolean>((result, key) => (result || key.length + properties[key].length > 124), false);
}