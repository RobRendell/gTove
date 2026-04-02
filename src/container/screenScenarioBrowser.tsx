import {FunctionComponent, useContext, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import * as THREE from 'three';

import {useCameraParameters} from '../context/cameraParametersProvider';
import {FileAPIContextObject} from '../context/fileAPIProvider';
import {PromiseModalContextObject} from '../context/promiseModalProvider';
import {DropDownMenuClickParams} from '../presentation/dropDownMenu';
import InputButton from '../presentation/inputButton';
import ScenarioFileEditor from '../presentation/scenarioFileEditor';
import {getAllFilesFromStore, getScenarioFromStore, getTabletopIdFromStore} from '../redux/mainReducer';
import {appendScenarioAction, setScenarioAction} from '../redux/scenarioReducer';
import {FOLDER_SCENARIO} from '../util/constants';
import {adjustScenarioOrigin, isScenarioEmpty, jsonToScenarioAndTabletop, scenarioToJson} from '../util/scenarioUtils';
import {FileMetadata, GridType} from '../util/storage/storageContract';
import BrowseFilesComponent from './browseFilesComponent';

interface ScreenScenarioBrowserProps {
    onFinish: () => void;
    isGMConnected: boolean;
    defaultGrid: GridType;
    createTutorial: (createTabletop: boolean) => void;
}

const ScreenScenarioBrowser: FunctionComponent<ScreenScenarioBrowserProps> = ({onFinish, isGMConnected, defaultGrid, createTutorial}) => {
    const dispatch = useDispatch();
    const files = useSelector(getAllFilesFromStore);
    const tabletopId = useSelector(getTabletopIdFromStore);
    const scenario = useSelector(getScenarioFromStore);
    const fileAPI = useContext(FileAPIContextObject);
    const {cameraPositionRef, cameraLookAtRef} = useCameraParameters();
    
    const globalActions = useMemo(() => ([
        {
            label: 'Save current tabletop',
            createsFile: true,
            onClick: async (parents: string[]) => {
                const name = 'New Scenario';
                const [privateScenario] = scenarioToJson(scenario);
                return await fileAPI.saveJsonToFile({name, parents}, privateScenario) as FileMetadata<void, void>;
            }
        }
    ]), [scenario, fileAPI]);
    const promiseModal = useContext(PromiseModalContextObject);
    const fileActions = useMemo(() => ([
        {
            label: 'Load to tabletop',
            disabled: () => (!isGMConnected),
            onClick: async (scenarioMetadata: FileMetadata, params?: DropDownMenuClickParams) => {
                if (!promiseModal?.isAvailable()) {
                    return;
                }
                const clearOption = 'Replace the tabletop\'s contents';
                const appendOption = 'Add the scenario without clearing the tabletop';
                const cancelOption = 'Cancel';
                const response = isScenarioEmpty(scenario)
                    ? clearOption
                    : await promiseModal({
                        children: (
                            <div>
                                <p>
                                    Your current tabletop is not clear.  You can clear the tabletop and
                                    replace its contents with this scenario, or simply add the maps, minis
                                    and templates from this scenario to your tabletop as it is.
                                </p>
                                <p>
                                    If you add the scenario without clearing, the scenario's contents will
                                    be centered and rotated on your current camera focus.  The newly added
                                    maps, minis and templates may end up overlapping with the tabletop's
                                    current content.
                                </p>
                            </div>
                        ),
                        options: [clearOption, appendOption, cancelOption]
                    });
                if (response !== cancelOption) {
                    params?.setShowBusySpinner && params.setShowBusySpinner(true);
                    const json = await fileAPI.getJsonFileContents(scenarioMetadata);
                    const [scenario] = jsonToScenarioAndTabletop(json, files.fileMetadata);
                    const [privateScenario, publicScenario] = scenarioToJson(scenario);
                    if (response === clearOption) {
                        dispatch(setScenarioAction(publicScenario, scenarioMetadata.id, false, true));
                        dispatch(setScenarioAction(privateScenario, 'gm' + scenarioMetadata.id, true));
                    } else {
                        const lookDirectionXZ = cameraLookAtRef.current.clone().sub(cameraPositionRef.current);
                        lookDirectionXZ.y = 0;
                        lookDirectionXZ.normalize();
                        // Looking in direction 0,0,-1 = no rotation.
                        const orientation = new THREE.Euler(0, lookDirectionXZ.z < 0 ? Math.asin(-lookDirectionXZ.x) : Math.PI - Math.asin(-lookDirectionXZ.x), 0);
                        dispatch(appendScenarioAction(
                            adjustScenarioOrigin(publicScenario, defaultGrid, cameraLookAtRef.current, orientation),
                            scenarioMetadata.id)
                        );
                        dispatch(appendScenarioAction(
                            adjustScenarioOrigin(privateScenario, defaultGrid, cameraLookAtRef.current, orientation),
                            'gm' + scenarioMetadata.id, true)
                        );
                    }
                    onFinish();
                }
            }
        },
        {label: 'Edit', onClick: 'edit' as const},
        {label: 'Select', onClick: 'select' as const},
        {label: 'Delete', onClick: 'delete' as const}
    ]), [cameraLookAtRef, cameraPositionRef, defaultGrid, dispatch, fileAPI, files.fileMetadata, isGMConnected, onFinish, promiseModal, scenario]);
    return (
        <BrowseFilesComponent<void, void>
            topDirectory={FOLDER_SCENARIO}
            highlightMetadataId={tabletopId}
            onBack={tabletopId ? onFinish : undefined}
            showSearch={false}
            allowUploadAndWebLink={false}
            allowMultiPick={false}
            globalActions={globalActions}
            fileActions={fileActions}
            editorComponent={ScenarioFileEditor}
            screenInfo={(folder: string, children: string[], loading: boolean) => {
                const createTutorialButton = !loading && folder === files.roots[FOLDER_SCENARIO]
                    && children.every((fileId) => (files.fileMetadata[fileId].name !== 'Tutorial Scenario'));
                return (
                    <div>
                        <p>Scenarios are used to save and restore tabletop layouts.  After you have set up the maps and
                            miniatures to your satisfaction in a tabletop, save them as a scenario here to preserve your
                            work and to move them between tabletops.  Pick a scenario to load it again into the current
                            tabletop.</p>
                        {
                            !createTutorialButton ? null : (
                                <InputButton type='button' onChange={() => (createTutorial(false))}>
                                    Create Tutorial Scenario
                                </InputButton>
                            )
                        }
                    </div>
                );
            }}
            jsonIcon='photo'
        />
    );
};

export default ScreenScenarioBrowser;