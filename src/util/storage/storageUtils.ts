import {AnyAction} from 'redux';
import {ThunkDispatch} from 'redux-thunk';
import {updateFileAction} from '../../redux/fileIndexReducer';
import {ReduxStoreType} from '../../redux/mainReducer';
import {FOLDER_TEMPLATE, MIME_TYPE_DRIVE_FOLDER} from '../constants';
import {
    defaultMiniProperties,
    defaultMapProperties,
    FileMetadata,
    FileShortcut,
    TabletopFileAppProperties,
    WebLinkProperties,
    TemplateProperties,
    PieceVisibilityEnum,
    TemplateShape,
    MiniProperties,
    MapProperties,
    GridType,
    AnyAppProperties,
    AnyProperties
} from './storageContract';
import { FileAPI } from './storageContract';

// CORS proxy for web link maps and minis
export const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';


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

export function castMiniProperties(properties?: MiniProperties): MiniProperties;
export function castMiniProperties(properties?: TemplateProperties): TemplateProperties;
export function castMiniProperties(properties?: MiniProperties | TemplateProperties): MiniProperties | TemplateProperties;
export function castMiniProperties(properties?: MiniProperties | TemplateProperties): MiniProperties | TemplateProperties {
    return (!properties) ? defaultMiniProperties :
        isTemplateProperties(properties) ? castTemplateProperties(properties) : {
        ...defaultMiniProperties,
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

export function castMapProperties(properties?: MapProperties): MapProperties {
    const gridColour = (properties?.gridColour) || GridType.NONE;
    return (properties) ? {
        ...properties,
        width: Number(properties.width),
        height: Number(properties.height),
        gridType: properties.gridType ? properties.gridType :
            gridColour ===  GridType.NONE ? GridType.NONE : GridType.SQUARE,
        gridColour,
        gridSize: Number(properties.gridSize),
        gridHeight: properties.gridHeight ? Number(properties.gridHeight) : undefined,
        gridOffsetX: Number(properties.gridOffsetX),
        gridOffsetY: Number(properties.gridOffsetY),
        fogWidth: Number(properties.fogWidth),
        fogHeight: Number(properties.fogHeight),
        showGrid: String(properties.showGrid) === 'true',
        pageCrop: typeof(properties.pageCrop) === 'string' ? JSON.parse(properties.pageCrop) : properties.pageCrop
    } : defaultMapProperties;
}

export function isFileShortcut(metadata: any): metadata is FileMetadata<void, FileShortcut> {
    return metadata.properties && metadata.properties.shortcutMetadataId !== undefined;
}


export function isTabletopFileAppProperties(appProperties: any): appProperties is TabletopFileAppProperties {
    return appProperties && appProperties.gmFile !== undefined;
}


// not sure if we need these anymore
// export function isTabletopFileMetadata(metadata: FileMetadata): boolean {
//     return metadata.appData && metadata.appData.gmFile !== undefined;
// }
// export function isTabletopFileMetadataFromDrive(metadata: any): boolean {
//     return metadata && metadata.appProperties && metadata.appProperties.gmFile !== undefined;
// }
export function isTabletopFileMetadata(metadata: any): metadata is FileMetadata<TabletopFileAppProperties, void> {
    return metadata && isTabletopFileAppProperties(metadata?.appProperties);
}

export function isWebLinkProperties(properties: any): properties is WebLinkProperties {
    return properties && properties.webLink !== undefined;
}

export function isTemplateProperties(properties: any): properties is TemplateProperties {
    return properties && properties.templateShape !== undefined;
}

export function isTemplateMetadata(metadata: any): metadata is FileMetadata<void, TemplateProperties> {
    return metadata && isTemplateProperties(metadata.properties);
}

export function isMiniProperties(properties: any): properties is MiniProperties {
    return properties && !isTemplateProperties(properties);
}

export function isMiniMetadata(metadata: any): metadata is FileMetadata<void, MiniProperties> {
    return metadata && isMiniProperties(metadata.properties);
}

export function anyPropertiesTooLong(properties: AnyAppProperties | AnyProperties): boolean {
    return !properties ? false :
        Object.keys(properties).reduce<boolean>((result, key) => 
            (result || key.length + (properties as any)[key].length > 124), false);
}

export function isMetadataOwnedByMe(metadata: FileMetadata) {
    return metadata.owners && metadata.owners.reduce((acc, owner) => (!!acc || !!owner?.me), false)
}

export async function updateFileMetadataAndDispatch(fileAPI: FileAPI, metadata: Partial<FileMetadata> | any, dispatch: ThunkDispatch<ReduxStoreType, {}, AnyAction>, transmit: boolean = false): Promise<FileMetadata> {
    let fileSystemMetadata = await fileAPI.uploadFileMetadata(metadata);
    if (isTabletopFileMetadata(fileSystemMetadata)) {
        // If there's an associated gmFile, update it as well
        dispatch(updateFileAction(fileSystemMetadata, transmit ? fileSystemMetadata.id : undefined));
        fileSystemMetadata = await fileAPI.uploadFileMetadata({...metadata, id: fileSystemMetadata.appData!.gmFile});
    }
    dispatch(updateFileAction(fileSystemMetadata, transmit ? fileSystemMetadata.id : undefined));
    return fileSystemMetadata;
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
class CORS_constant {
    static readonly CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';
}

export function corsUrl(url: string) {
    return (url[0] === '/') ? url : CORS_constant.CORS_PROXY + url;
}


export function isSupportedVideoMimeType(mimeType?: string) {
    return (mimeType === 'video/mp4' || mimeType === 'video/webm');
}

export function sortMetadataIdsByName(fileSystemMetadata: {[id: string]: FileMetadata}, metadataIds: string[] = []): string[] {
    return metadataIds
        .filter((id) => (fileSystemMetadata[id]))
        .sort((id1, id2) => {
            const file1 = fileSystemMetadata[id1];
            const file2 = fileSystemMetadata[id2];
            const isFolder1 = (file1.mimeType === MIME_TYPE_DRIVE_FOLDER);
            const isFolder2 = (file2.mimeType === MIME_TYPE_DRIVE_FOLDER);
            if (isFolder1 && !isFolder2) {
                return -1;
            } else if (!isFolder1 && isFolder2) {
                return 1;
            } else {
                return file1.name < file2.name ? -1 : (file1.name === file2.name ? 0 : 1);
            }
        });
}