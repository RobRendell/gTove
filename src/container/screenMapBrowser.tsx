import {FunctionComponent, useContext, useMemo, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {toast} from 'react-toastify';

import {FileMetadata, MapProperties} from '../util/storage/storageContract';
import BrowseFilesComponent, {BrowseFilesComponentFileAction,
    BrowseFilesComponentFileOnClickOptionalResult} from './browseFilesComponent';
import {FOLDER_MAP} from '../util/constants';
import {replaceMapImageAction, replaceMetadataAction} from '../redux/scenarioReducer';
import MapEditor from '../presentation/mapEditor';
import {getScenarioFromStore} from '../redux/mainReducer';
import {FileAPIContextObject} from '../context/fileAPIContextBridge';

function hasNoMapProperties(metadata: FileMetadata<void, MapProperties>) {
    return !metadata.properties?.width;
}

interface ScreenMapBrowserProps {
    onFinish: () => void;
    placeMap: (mapMetadata: FileMetadata<void, MapProperties>) => void;
    replaceMapMetadataId?: string;
    setReplaceMetadata?: (isMap: boolean) => void;
    replaceMapImageId?: string;
    setReplaceMapImage?: () => void;
}

const ScreenMapBrowser: FunctionComponent<ScreenMapBrowserProps> = (props) => {
    const {
        onFinish, placeMap, replaceMapMetadataId, setReplaceMetadata, replaceMapImageId, setReplaceMapImage
    } = props;
    const dispatch = useDispatch();
    const fileAPI = useContext(FileAPIContextObject);
    const scenario = useSelector(getScenarioFromStore);
    const [copyMapMetadataId, setCopyMapMetadataId] = useState('');
    const fileActions = useMemo<BrowseFilesComponentFileAction<void, MapProperties>[]>(() => (
        [
            {
                label: (copyMapMetadataId) ? 'Copy grid...'
                        : ((replaceMapMetadataId && setReplaceMetadata) || (replaceMapImageId && setReplaceMapImage)) ? 'Replace with this map'
                        : 'Add {} to tabletop',
                disabled: (metadata) => (metadata.id === copyMapMetadataId),
                onClick: async (metadata: FileMetadata<void, MapProperties>): Promise<void | BrowseFilesComponentFileOnClickOptionalResult<void, MapProperties>> => {
                    if (copyMapMetadataId) {
                        const editMetadata = await fileAPI.getFullMetadata(copyMapMetadataId);
                        setCopyMapMetadataId('');
                        toast(`Grid parameters copied from ${metadata.name} to ${editMetadata.name}`);
                        return {
                            postAction: 'edit',
                            metadata: {
                                ...editMetadata,
                                ...metadata,
                                id: editMetadata.id, 
                                name: editMetadata.name} as FileMetadata<void, MapProperties>
                        }
                    } else if (replaceMapMetadataId && setReplaceMetadata) {
                        const gmOnly = Object.keys(scenario.maps)
                            .filter((mapId) => (scenario.maps[mapId].metadata.id === replaceMapMetadataId))
                            .reduce((gmOnly, mapId) => (gmOnly && scenario.maps[mapId].gmOnly), true);
                        dispatch(replaceMetadataAction(replaceMapMetadataId, metadata, gmOnly));
                        setReplaceMetadata(true);
                        onFinish();
                    } else if (replaceMapImageId && setReplaceMapImage) {
                        const gmOnly = scenario.maps[replaceMapImageId].gmOnly;
                        dispatch(replaceMapImageAction(replaceMapImageId, metadata, gmOnly));
                        setReplaceMapImage();
                        onFinish();
                    } else {
                        placeMap(metadata);
                    }
                    return undefined;
                }
            },
            {label: 'Edit', onClick: 'edit' as const},
            {label: 'Select', onClick: 'select' as const},
            {
                label: copyMapMetadataId ? 'Cancel copy from' : 'Copy from...',
                onClick: async (metadata: FileMetadata<void, MapProperties>) => {
                    if (copyMapMetadataId) {
                        setCopyMapMetadataId('');
                    } else {
                        toast('Pick a map to copy the grid and other parameters from, replacing the grid of ' + metadata.name);
                        setCopyMapMetadataId(metadata.id);
                    }
                }
            },
            {label: 'Delete', onClick: 'delete' as const}
        ]
    ), [fileAPI, dispatch, copyMapMetadataId, onFinish, placeMap, replaceMapImageId, replaceMapMetadataId, scenario.maps, setReplaceMapImage, setReplaceMetadata]);
    return (
        <BrowseFilesComponent<void, MapProperties>
            topDirectory={FOLDER_MAP}
            onBack={onFinish}
            showSearch={true}
            allowUploadAndWebLink={true}
            allowMultiPick={!copyMapMetadataId && !replaceMapMetadataId && !replaceMapImageId}
            fileActions={fileActions}
            fileIsNew={hasNoMapProperties}
            editorComponent={MapEditor}
            screenInfo={replaceMapImageId ? (
                <div className='browseFilesScreenInfo'>
                    <p>
                        Upload or Pick the new map whose image will replace map
                        "{scenario.maps[replaceMapImageId].name}" on the tabletop.  The new image
                        may be a different resolution to {scenario.maps[replaceMapImageId].name},
                        but to ensure Fog of War lines up correctly, make sure you have defined a grid that is the same
                        number of tiles wide and high.  Be especially careful that any thin slivers of tiles at the
                        edges of the old map's grid are also present on the new map's grid.
                    </p>
                    <p>
                        Your map's Fog of War data will not change unless you explicitly cover or uncover any tiles,
                        so if the fog does not align correctly with the new image, you can edit the new map's grid to
                        attempt to fix things, or even revert back to the original map image, without losing anything.
                    </p>
                </div>
            ) : replaceMapMetadataId ? (
                <p>
                    Upload or Pick the new map to use.
                </p>
            ) : undefined}
        />
    );
};

export default ScreenMapBrowser;