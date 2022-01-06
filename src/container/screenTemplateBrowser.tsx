import {FunctionComponent, useContext, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {toast} from 'react-toastify';

import BrowseFilesComponent from './browseFilesComponent';
import {
    castTemplateProperties,
    DriveMetadata,
    IconShapeEnum,
    PieceVisibilityEnum,
    TemplateProperties,
    TemplateShape
} from '../util/googleDriveUtils';
import {FOLDER_TEMPLATE} from '../util/constants';
import {
    getColourHexString,
    isMapFoggedAtPosition,
    MovementPathPoint
} from '../util/scenarioUtils';
import {addMiniAction} from '../redux/scenarioReducer';
import TemplateEditor from '../presentation/templateEditor';
import {getAllFilesFromStore, getFolderStacksFromStore, getScenarioFromStore} from '../redux/mainReducer';
import {FileAPIContextObject} from '../context/fileAPIContextBridge';

const templateIcon = {
    [TemplateShape.CIRCLE]: 'fiber_manual_record',
    [TemplateShape.ARC]: 'signal_wifi_4_bar'
};

interface ScreenTemplateBrowserProps {
    onFinish: () => void;
    findPositionForNewMini: (allowHiddenMap: boolean) => MovementPathPoint;
    isGM: boolean;
}

const ScreenTemplateBrowser: FunctionComponent<ScreenTemplateBrowserProps> = ({onFinish, findPositionForNewMini, isGM}) => {
    const dispatch = useDispatch();
    const files = useSelector(getAllFilesFromStore);
    const folderStacks = useSelector(getFolderStacksFromStore);
    const fileAPI = useContext(FileAPIContextObject);
    const scenario = useSelector(getScenarioFromStore);
    const globalActions = useMemo(() => ([
        {label: 'Add Template', createsFile: true, onClick: async (parents: string[]) => {
            const metadata = await fileAPI.saveJsonToFile({name: 'New Template', parents}, {});
            await fileAPI.makeFileReadableToAll(metadata);
            return metadata as DriveMetadata<void, TemplateProperties>;
        }}
    ]), [fileAPI]);
    const fileActions = useMemo(() => ([
        {
            label: 'Pick',
            disabled: (metadata: DriveMetadata<void, TemplateProperties>) => (!metadata.properties || !metadata.properties.templateShape),
            onClick: (templateMetadata: DriveMetadata<void, TemplateProperties>) => {
                const properties = castTemplateProperties(templateMetadata.properties);
                const visibility = properties.defaultVisibility || PieceVisibilityEnum.FOGGED;
                const position = findPositionForNewMini(visibility === PieceVisibilityEnum.HIDDEN);
                const onFog = position.onMapId ? isMapFoggedAtPosition(scenario.maps[position.onMapId], position) : false;
                const gmOnly = (visibility === PieceVisibilityEnum.HIDDEN || (visibility === PieceVisibilityEnum.FOGGED && onFog));
                if (gmOnly && !isGM) {
                    toast(templateMetadata.name + ' added, but it is hidden from you.');
                }
                dispatch(addMiniAction({
                    metadata: templateMetadata,
                    name: templateMetadata.name,
                    visibility,
                    gmOnly,
                    position, movementPath: scenario.confirmMoves ? [position] : undefined
                }));
                onFinish();
            }
        },
        {label: 'Edit', onClick: 'edit' as const},
        {label: 'Select', onClick: 'select' as const},
        {label: 'Delete', onClick: 'delete' as const}
    ]), [scenario.confirmMoves, scenario.maps, isGM, dispatch, findPositionForNewMini, onFinish]);
    return (
        <BrowseFilesComponent<void, TemplateProperties>
            files={files}
            dispatch={dispatch}
            topDirectory={FOLDER_TEMPLATE}
            folderStack={folderStacks[FOLDER_TEMPLATE]}
            onBack={onFinish}
            showSearch={true}
            allowUploadAndWebLink={false}
            allowMultiPick={true}
            globalActions={globalActions}
            fileActions={fileActions}
            editorComponent={TemplateEditor}
            jsonIcon={(metadata: DriveMetadata<void, TemplateProperties>) => {
                if (metadata.properties) {
                    const properties = castTemplateProperties(metadata.properties);
                    const colour = getColourHexString(properties.colour);
                    return (properties.templateShape === TemplateShape.RECTANGLE) ? (
                        <div className='rectangleTemplateIcon' style={{backgroundColor: colour}}/>
                    ) : (properties.templateShape === TemplateShape.ICON) ? (
                        <div className='material-icons' style={{color: colour}}>{properties.iconShape || IconShapeEnum.comment}</div>
                    ) : (
                        <div className='material-icons' style={{color: colour}}>{templateIcon[properties.templateShape]}</div>
                    );
                } else {
                    return (<div className='material-icons'>fiber_new</div>);
                }
            }}
        />
    );
};

export default ScreenTemplateBrowser;