import {FunctionComponent, useContext, useMemo} from 'react';
import {useDispatch, useSelector, useStore} from 'react-redux';
import {toast} from 'react-toastify';

import {useCameraParameters} from '../context/cameraParametersContextBridge';
import {FileAPIContextObject} from '../context/fileAPIContextBridge';
import TemplateEditor from '../presentation/templateEditor';
import {getScenarioFromStore, getTabletopFromStore} from '../redux/mainReducer';
import {addMiniAction} from '../redux/scenarioReducer';
import {FOLDER_TEMPLATE} from '../util/constants';
import {findPositionForNewMini, getColourHexString, isMapFoggedAtPosition} from '../util/scenarioUtils';
import {
    FileMetadata,
    IconShapeEnum,
    PieceVisibilityEnum,
    TemplateProperties,
    TemplateShape
} from '../util/storage/storageContract';
import {castTemplateProperties} from '../util/storage/storageUtils';
import BrowseFilesComponent from './browseFilesComponent';

const templateIcon = {
    [TemplateShape.CIRCLE]: 'fiber_manual_record',
    [TemplateShape.ARC]: 'signal_wifi_4_bar'
};

interface ScreenTemplateBrowserProps {
    onFinish: () => void;
    isGM: boolean;
}

const ScreenTemplateBrowser: FunctionComponent<ScreenTemplateBrowserProps> = ({onFinish, isGM}) => {
    const dispatch = useDispatch();
    const store = useStore();
    const fileAPI = useContext(FileAPIContextObject);
    const scenario = useSelector(getScenarioFromStore);
    const {cameraLookAtRef} = useCameraParameters();
    
    const globalActions = useMemo(() => ([
        {label: 'Add Template', createsFile: true, onClick: async (parents: string[]) => {
            const metadata = await fileAPI.saveJsonToFile({name: 'New Template', parents}, {});
            await fileAPI.makeFileReadableToAll(metadata);
            return metadata as FileMetadata<void, TemplateProperties>;
        }}
    ]), [fileAPI]);
    const fileActions = useMemo(() => ([
        {
            label: 'Add {} to tabletop',
            disabled: (metadata: FileMetadata<void, TemplateProperties>) => (!metadata.properties || !metadata.properties.templateShape),
            onClick: (templateMetadata: FileMetadata<void, TemplateProperties>) => {
                const properties = castTemplateProperties(templateMetadata.properties!);
                const visibility = properties.defaultVisibility || PieceVisibilityEnum.FOGGED;
                const position = findPositionForNewMini(getScenarioFromStore(store.getState()),
                    getTabletopFromStore(store.getState()), visibility === PieceVisibilityEnum.HIDDEN, cameraLookAtRef.current);
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
                    position,
                    elevation: properties.height / 2,
                    movementPath: scenario.confirmMoves ? [position] : undefined
                }));
                onFinish();
            }
        },
        {label: 'Edit', onClick: 'edit' as const},
        {label: 'Select', onClick: 'select' as const},
        {label: 'Delete', onClick: 'delete' as const}
    ]), [store, cameraLookAtRef, scenario.maps, scenario.confirmMoves, isGM, dispatch, onFinish]);
    return (
        <BrowseFilesComponent<void, TemplateProperties>
            topDirectory={FOLDER_TEMPLATE}
            onBack={onFinish}
            showSearch={true}
            allowUploadAndWebLink={false}
            allowMultiPick={true}
            globalActions={globalActions}
            fileActions={fileActions}
            editorComponent={TemplateEditor}
            jsonIcon={(metadata: FileMetadata<void, TemplateProperties>) => {
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