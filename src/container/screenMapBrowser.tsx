import {FunctionComponent, useContext, useMemo, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {toast} from 'react-toastify';

import {DriveMetadata, MapProperties} from '../util/googleDriveUtils';
import BrowseFilesComponent from './browseFilesComponent';
import {FOLDER_MAP} from '../util/constants';
import {replaceMapImageAction, replaceMetadataAction} from '../redux/scenarioReducer';
import MapEditor from '../presentation/mapEditor';
import {getAllFilesFromStore, getFolderStacksFromStore, getScenarioFromStore} from '../redux/mainReducer';
import {FileAPIContextObject} from '../context/fileAPIContextBridge';

function hasNoMapProperties(metadata: DriveMetadata<void, MapProperties>) {
    return !metadata.properties?.width;
}

interface ScreenMapBrowserProps {
    onFinish: () => void;
    placeMap: (mapMetadata: DriveMetadata<void, MapProperties>) => void;
    replaceMapMetadataId?: string;
    setReplaceMetadata?: (isMap: boolean) => void;
    replaceMapImageId?: string;
    setReplaceMapImage?: () => void;
}

const ScreenMapBrowser: FunctionComponent<ScreenMapBrowserProps> = (props) => {
    const {
        onFinish, placeMap, replaceMapMetadataId, setReplaceMetadata, replaceMapImageId, setReplaceMapImage
    } = props;
    const files = useSelector(getAllFilesFromStore);
    const dispatch = useDispatch();
    const folderStacks = useSelector(getFolderStacksFromStore);
    const fileAPI = useContext(FileAPIContextObject);
    const scenario = useSelector(getScenarioFromStore);
    const [copyMapMetadataId, setCopyMapMetadataId] = useState('');
    const fileActions = useMemo(() => (
        [
            {
                label: 'Pick',
                disabled: hasNoMapProperties,
                onClick: async (metadata: DriveMetadata<void, MapProperties>) => {
                    if (copyMapMetadataId) {
                        const editMetadata = await fileAPI.getFullMetadata(copyMapMetadataId);
                        setCopyMapMetadataId('');
                        toast(`Grid parameters copied from ${metadata.name} to ${editMetadata.name}`);
                        return {
                            postAction: 'edit',
                            metadata: {...editMetadata, ...metadata, id: editMetadata.id, name: editMetadata.name}
                        }
                    } else if (replaceMapMetadataId && setReplaceMetadata) {
                        const gmOnly = Object.keys(scenario.maps)
                            .filter((mapId) => (scenario.maps[mapId].metadata.id === replaceMapMetadataId))
                            .reduce((gmOnly, mapId) => (gmOnly && scenario.maps[mapId].gmOnly), true);
                        dispatch(replaceMetadataAction(replaceMapMetadataId, metadata.id, gmOnly));
                        setReplaceMetadata(true);
                        onFinish();
                    } else if (replaceMapImageId && setReplaceMapImage) {
                        const gmOnly = scenario.maps[replaceMapImageId].gmOnly;
                        dispatch(replaceMapImageAction(replaceMapImageId, metadata.id, gmOnly));
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
                label: 'Copy from...',
                onClick: async (metadata: DriveMetadata<void, MapProperties>) => {
                    toast('Pick a map to copy the grid and other parameters from, replacing the grid of ' + metadata.name);
                    setCopyMapMetadataId(metadata.id);
                }
            },
            {label: 'Delete', onClick: 'delete' as const}
        ]
    ), [fileAPI, dispatch, copyMapMetadataId, onFinish, placeMap, replaceMapImageId, replaceMapMetadataId, scenario.maps, setReplaceMapImage, setReplaceMetadata]);
    return (
        <BrowseFilesComponent<void, MapProperties>
            files={files}
            dispatch={dispatch}
            topDirectory={FOLDER_MAP}
            folderStack={folderStacks[FOLDER_MAP]}
            onBack={onFinish}
            showSearch={true}
            allowUploadAndWebLink={true}
            allowMultiPick={true}
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