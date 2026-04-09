import {FunctionComponent, useContext, useMemo, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {toast} from 'react-toastify';

import {FileAPIContextObject} from '../context/fileAPIProvider';
import MapEditor from '../presentation/mapEditor';
import {getScenarioFromStore, getTabletopStateFromStore} from '../redux/mainReducer';
import {replaceMapImageAction, replaceMetadataAction} from '../redux/scenarioReducer';
import {setTabletopStateScenarioReplaceStateAction} from '../redux/tabletopStateReducer';
import {FOLDER_MAP} from '../util/constants';
import {FileMetadata, MapProperties} from '../util/storage/storageContract';
import BrowseFilesComponent, {
    BrowseFilesComponentFileAction,
    BrowseFilesComponentFileOnClickOptionalResult
} from './browseFilesComponent';

function hasNoMapProperties(metadata: FileMetadata<void, MapProperties>) {
    return !metadata.properties?.width;
}

interface ScreenMapBrowserProps {
    onFinish: () => void;
    placeMap: (mapMetadata: FileMetadata<void, MapProperties>) => void;
}

const ScreenMapBrowser: FunctionComponent<ScreenMapBrowserProps> = ({onFinish, placeMap}) => {
    const dispatch = useDispatch();
    const fileAPI = useContext(FileAPIContextObject);
    const scenario = useSelector(getScenarioFromStore);
    const {scenarioReplace} = useSelector(getTabletopStateFromStore);

    const [copyMapMetadataId, setCopyMapMetadataId] = useState('');
    const fileActions = useMemo<BrowseFilesComponentFileAction<void, MapProperties>[]>(() => (
        [
            {
                label: (copyMapMetadataId) ? 'Copy grid...'
                        : (scenarioReplace?.mapMetadataId || scenarioReplace?.mapImageId) ? 'Replace with this map'
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
                    } else if (scenarioReplace?.mapMetadataId) {
                        const gmOnly = Object.keys(scenario.maps)
                            .filter((mapId) => (scenario.maps[mapId].metadata.id === scenarioReplace?.mapMetadataId))
                            .every((mapId) => (scenario.maps[mapId].gmOnly));
                        dispatch(replaceMetadataAction(scenarioReplace?.mapMetadataId, metadata, gmOnly));
                        dispatch(setTabletopStateScenarioReplaceStateAction());
                        onFinish();
                    } else if (scenarioReplace?.mapImageId) {
                        const gmOnly = scenario.maps[scenarioReplace.mapImageId].gmOnly;
                        dispatch(replaceMapImageAction(scenarioReplace.mapImageId, metadata, gmOnly));
                        dispatch(setTabletopStateScenarioReplaceStateAction());
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
    ), [copyMapMetadataId, scenarioReplace, fileAPI, scenario.maps, dispatch, onFinish, placeMap]);
    return (
        <BrowseFilesComponent<void, MapProperties>
            topDirectory={FOLDER_MAP}
            onBack={onFinish}
            showSearch={true}
            allowUploadAndWebLink={true}
            allowMultiPick={!copyMapMetadataId && !scenarioReplace?.mapMetadataId && !scenarioReplace?.mapImageId}
            fileActions={fileActions}
            fileIsNew={hasNoMapProperties}
            editorComponent={MapEditor}
            screenInfo={scenarioReplace?.mapImageId ? (
                <div className='browseFilesScreenInfo'>
                    <p>
                        Upload or Pick the new map whose image will replace map
                        "{scenario.maps[scenarioReplace.mapImageId].name}" on the tabletop.  The new image
                        may be a different resolution to {scenario.maps[scenarioReplace.mapImageId].name},
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
            ) : scenarioReplace?.mapMetadataId ? (
                <p>
                    Upload or Pick the new map to use.
                </p>
            ) : undefined}
        />
    );
};

export default ScreenMapBrowser;