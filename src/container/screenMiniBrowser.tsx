import {FunctionComponent, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import MiniEditor from '../presentation/miniEditor';
import {getScenarioFromStore, getTabletopStateFromStore} from '../redux/mainReducer';
import {replaceMetadataAction} from '../redux/scenarioReducer';
import {setTabletopStateScenarioReplaceStateAction} from '../redux/tabletopStateReducer';
import {FOLDER_MINI} from '../util/constants';
import {FileMetadata, MiniProperties} from '../util/storage/storageContract';
import BrowseFilesComponent, {BrowseFilesComponentFileAction} from './browseFilesComponent';

function hasNoMiniAppData(metadata: FileMetadata<void, MiniProperties>) {
    return !metadata.properties?.width;
}

interface ScreenMiniBrowserProps {
    onFinish: () => void;
    placeMini: (miniMetadata: FileMetadata<void, MiniProperties>) => void;
}

const ScreenMiniBrowser: FunctionComponent<ScreenMiniBrowserProps> = ({onFinish, placeMini}) => {
    const dispatch = useDispatch();
    const scenario = useSelector(getScenarioFromStore);
    const {scenarioReplace} = useSelector(getTabletopStateFromStore);
    
    const fileActions = useMemo<BrowseFilesComponentFileAction<void, MiniProperties>[]>(() => ([
        {
            label: (scenarioReplace?.miniMetadataId) ? 'Replace with this mini' : 'Add {} to tabletop',
            onClick: (miniMetadata) => {
                if (scenarioReplace?.miniMetadataId) {
                    const gmOnly = Object.keys(scenario.minis).reduce((gmOnly, miniId) => (gmOnly && scenario.minis[miniId].gmOnly), true);
                    dispatch(replaceMetadataAction(scenarioReplace.miniMetadataId, miniMetadata, gmOnly));
                    dispatch(setTabletopStateScenarioReplaceStateAction());
                    onFinish();
                } else {
                    placeMini(miniMetadata);
                }
            }
        },
        {label: 'Edit', onClick: 'edit' as const},
        {label: 'Select', onClick: 'select' as const},
        {label: 'Delete', onClick: 'delete' as const}
    ]), [scenarioReplace, scenario.minis, dispatch, onFinish, placeMini]);
    return (
        <BrowseFilesComponent<void, MiniProperties>
            topDirectory={FOLDER_MINI}
            onBack={onFinish}
            showSearch={true}
            allowUploadAndWebLink={true}
            allowMultiPick={!scenarioReplace?.miniMetadataId}
            fileActions={fileActions}
            fileIsNew={hasNoMiniAppData}
            editorComponent={MiniEditor}
            screenInfo={scenarioReplace?.miniMetadataId ? (
                <div className='browseFilesScreenInfo'>
                    Upload or Pick the new mini to use.
                </div>
            ) : undefined}
        />
    );
};

export default ScreenMiniBrowser;