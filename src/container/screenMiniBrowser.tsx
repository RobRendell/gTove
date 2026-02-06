import {FunctionComponent, useMemo} from 'react';

import {FileMetadata, MiniProperties} from '../util/storage/storageContract';
import {FOLDER_MINI} from '../util/constants';
import BrowseFilesComponent, {BrowseFilesComponentFileAction} from './browseFilesComponent';
import {replaceMetadataAction} from '../redux/scenarioReducer';
import MiniEditor from '../presentation/miniEditor';
import {useDispatch, useSelector} from 'react-redux';
import {getScenarioFromStore} from '../redux/mainReducer';

function hasNoMiniAppData(metadata: FileMetadata<void, MiniProperties>) {
    return !metadata.properties?.width;
}

interface ScreenMiniBrowserProps {
    onFinish: () => void;
    placeMini: (miniMetadata: FileMetadata<void, MiniProperties>) => void;
    replaceMiniMetadataId?: string;
    setReplaceMetadata?: (isMap: boolean) => void;
}

const ScreenMiniBrowser: FunctionComponent<ScreenMiniBrowserProps> = ({onFinish, placeMini, replaceMiniMetadataId, setReplaceMetadata}) => {
    const dispatch = useDispatch();
    const scenario = useSelector(getScenarioFromStore);
    const fileActions = useMemo<BrowseFilesComponentFileAction<void, MiniProperties>[]>(() => ([
        {
            label: (replaceMiniMetadataId && setReplaceMetadata) ? 'Replace with this mini' : 'Add {} to tabletop',
            onClick: (miniMetadata) => {
                if (replaceMiniMetadataId && setReplaceMetadata) {
                    const gmOnly = Object.keys(scenario.minis).reduce((gmOnly, miniId) => (gmOnly && scenario.minis[miniId].gmOnly), true);
                    dispatch(replaceMetadataAction(replaceMiniMetadataId, miniMetadata, gmOnly));
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
            topDirectory={FOLDER_MINI}
            onBack={onFinish}
            showSearch={true}
            allowUploadAndWebLink={true}
            allowMultiPick={!replaceMiniMetadataId}
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