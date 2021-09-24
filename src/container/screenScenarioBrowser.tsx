import {FunctionComponent, useContext, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import * as THREE from 'three';

import BrowseFilesComponent from './browseFilesComponent';
import {FOLDER_SCENARIO} from '../util/constants';
import {adjustScenarioOrigin, isScenarioEmpty, jsonToScenarioAndTabletop, scenarioToJson} from '../util/scenarioUtils';
import {DriveMetadata, GridType} from '../util/googleDriveUtils';
import {DropDownMenuClickParams} from '../presentation/dropDownMenu';
import {appendScenarioAction, setScenarioAction} from '../redux/scenarioReducer';
import ScenarioFileEditor from '../presentation/scenarioFileEditor';
import InputButton from '../presentation/inputButton';
import {
    getAllFilesFromStore,
    getFolderStacksFromStore,
    getScenarioFromStore,
    getTabletopIdFromStore
} from '../redux/mainReducer';
import {FileAPIContextObject} from '../context/fileAPIContextBridge';
import {PromiseModalContextObject} from '../context/promiseModalContextBridge';

interface ScreenScenarioBrowserProps {
    onFinish: () => void;
    isGMConnected: boolean;
    cameraLookAt: THREE.Vector3;
    cameraPosition: THREE.Vector3;
    defaultGrid: GridType;
    createTutorial: (createTabletop: boolean) => void;
}

const ScreenScenarioBrowser: FunctionComponent<ScreenScenarioBrowserProps> = ({onFinish, isGMConnected, cameraLookAt, cameraPosition, defaultGrid, createTutorial}) => {
    const dispatch = useDispatch();
    const files = useSelector(getAllFilesFromStore);
    const folderStacks = useSelector(getFolderStacksFromStore);
    const tabletopId = useSelector(getTabletopIdFromStore);
    const scenario = useSelector(getScenarioFromStore);
    const fileAPI = useContext(FileAPIContextObject);
    const globalActions = useMemo(() => ([
        {
            label: 'Save current tabletop',
            createsFile: true,
            onClick: async (parents: string[]) => {
                const name = 'New Scenario';
                const [privateScenario] = scenarioToJson(scenario);
                return await fileAPI.saveJsonToFile({name, parents}, privateScenario) as DriveMetadata<void, void>;
            }
        }
    ]), [scenario, fileAPI]);
    const promiseModal = useContext(PromiseModalContextObject);
    const fileActions = useMemo(() => ([
        {
            label: 'Pick',
            disabled: () => (!isGMConnected),
            onClick: async (scenarioMetadata: DriveMetadata, params?: DropDownMenuClickParams) => {
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
                    params && params.showBusySpinner && params.showBusySpinner(true);
                    const json = await fileAPI.getJsonFileContents(scenarioMetadata);
                    const [scenario] = jsonToScenarioAndTabletop(json, files.driveMetadata);
                    const [privateScenario, publicScenario] = scenarioToJson(scenario);
                    if (response === clearOption) {
                        dispatch(setScenarioAction(publicScenario, scenarioMetadata.id, false, true));
                        dispatch(setScenarioAction(privateScenario, 'gm' + scenarioMetadata.id, true));
                    } else {
                        const lookDirectionXZ = cameraLookAt.clone().sub(cameraPosition);
                        lookDirectionXZ.y = 0;
                        lookDirectionXZ.normalize();
                        // Looking in direction 0,0,-1 = no rotation.
                        const orientation = new THREE.Euler(0, lookDirectionXZ.z < 0 ? Math.asin(-lookDirectionXZ.x) : Math.PI - Math.asin(-lookDirectionXZ.x), 0);
                        dispatch(appendScenarioAction(
                            adjustScenarioOrigin(publicScenario, defaultGrid, cameraLookAt, orientation),
                            scenarioMetadata.id)
                        );
                        dispatch(appendScenarioAction(
                            adjustScenarioOrigin(privateScenario, defaultGrid, cameraLookAt, orientation),
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
    ]), [cameraLookAt, cameraPosition, defaultGrid, dispatch, fileAPI, files.driveMetadata, isGMConnected, onFinish, promiseModal, scenario]);
    return (
        <BrowseFilesComponent<void, void>
            files={files}
            dispatch={dispatch}
            topDirectory={FOLDER_SCENARIO}
            folderStack={folderStacks[FOLDER_SCENARIO]}
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
                    && children.reduce((result, fileId) => (result && files.driveMetadata[fileId].name !== 'Tutorial Scenario'), true);
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