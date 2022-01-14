import {FunctionComponent, useMemo} from 'react';

import {DriveMetadata, MiniProperties} from '../util/googleDriveUtils';
import {FOLDER_MINI} from '../util/constants';
import BrowseFilesComponent from './browseFilesComponent';
import {replaceMetadataAction} from '../redux/scenarioReducer';
import MiniEditor from '../presentation/miniEditor';
import {useDispatch, useSelector, useStore} from 'react-redux';
import {
    getAllFilesFromStore,
    getFolderStacksFromStore,
    getScenarioFromStore,
    getUploadPlaceholdersFromStore
} from '../redux/mainReducer';

function hasNoMiniAppData(metadata: DriveMetadata<void, MiniProperties>) {
    return !metadata.properties?.width;
}

interface ScreenMiniBrowserProps {
    onFinish: () => void;
    placeMini: (miniMetadata: DriveMetadata<void, MiniProperties>) => void;
    replaceMiniMetadataId?: string;
    setReplaceMetadata?: (isMap: boolean) => void;
}

const ScreenMiniBrowser: FunctionComponent<ScreenMiniBrowserProps> = ({onFinish, placeMini, replaceMiniMetadataId, setReplaceMetadata}) => {
    const store = useStore();
    const dispatch = useDispatch();
    const files = useSelector(getAllFilesFromStore);
    const folderStacks = useSelector(getFolderStacksFromStore);
    const uploadPlaceholders = useSelector(getUploadPlaceholdersFromStore);
    const scenario = useSelector(getScenarioFromStore);
    const fileActions = useMemo(() => ([
        {
            label: 'Pick',
            onClick: (miniMetadata: DriveMetadata<void, MiniProperties>) => {
                if (replaceMiniMetadataId && setReplaceMetadata) {
                    const gmOnly = Object.keys(scenario.minis).reduce((gmOnly, miniId) => (gmOnly && scenario.minis[miniId].gmOnly), true);
                    dispatch(replaceMetadataAction(replaceMiniMetadataId, miniMetadata.id, gmOnly));
                    setReplaceMetadata(false);
                    onFinish();
                } else {
                    placeMini(miniMetadata);
                }
            }
        },
        {label: 'Edit', onClick: 'edit' as const},
        {label: 'Select', onClick: 'select' as const},
        {label: 'Delete', onClick: 'delete' as const}
    ]), [scenario, dispatch, replaceMiniMetadataId, setReplaceMetadata, placeMini, onFinish]);
    return (
        <BrowseFilesComponent<void, MiniProperties>
            store={store}
            files={files}
            dispatch={dispatch}
            topDirectory={FOLDER_MINI}
            folderStack={folderStacks[FOLDER_MINI]}
            uploadPlaceholders={uploadPlaceholders}
            onBack={onFinish}
            showSearch={true}
            allowUploadAndWebLink={true}
            allowMultiPick={true}
            fileActions={fileActions}
            fileIsNew={hasNoMiniAppData}
            editorComponent={MiniEditor}
            screenInfo={replaceMiniMetadataId ? (
                <div className='browseFilesScreenInfo'>
                    Upload or Pick the new mini to use.
                </div>
            ) : undefined}
        />
    );
};

export default ScreenMiniBrowser;