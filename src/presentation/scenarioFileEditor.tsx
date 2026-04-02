import './scenarioFileEditor.scss';

import {FunctionComponent, useCallback, useContext, useState} from 'react';
import {AnyAction} from 'redux';
import {ThunkAction} from 'redux-thunk';

import {FileAPIContextObject} from '../context/fileAPIProvider';
import {FileIndexReducerType} from '../redux/fileIndexReducerTypes';
import {ReduxStoreType} from '../redux/mainReducerTypes';
import {settableScenarioReducer} from '../redux/scenarioReducer';
import {ScenarioReducerActionTypes} from '../redux/scenarioReducerTypes';
import {scenarioToJson, ScenarioType} from '../util/scenarioUtils';
import InputButton from './inputButton';
import {default as RenameFileEditor, RenameFileEditorProps} from './renameFileEditor';
import TabletopPreviewComponent from './tabletopPreviewComponent';

interface ScenarioFileEditorProps extends RenameFileEditorProps<void, void> {
    scenario: ScenarioType;
    newFile: boolean;
    files: FileIndexReducerType;
}

const ScenarioFileEditor: FunctionComponent<ScenarioFileEditorProps> = (props) => {
    const fileAPI = useContext(FileAPIContextObject);

    const [saving, setSaving] = useState(false);
    const [fileScenario, setFileScenario] = useState<ScenarioType | undefined>();

    const scenarioDispatch = useCallback((action: AnyAction | ThunkAction<void, ReduxStoreType, {}, AnyAction>) => {
        // If the tabletopPreviewComponent updates the scenario metadata, we need to update our state.
        if (typeof(action) !== 'function' &&
            ((action.type === ScenarioReducerActionTypes.UPDATE_MINI_ACTION && action.mini.metadata) ||
                (action.type === ScenarioReducerActionTypes.UPDATE_MAP_ACTION && action.map.metadata))) {
            setFileScenario((prevState) => (settableScenarioReducer(prevState, action)));
        }
    }, []);

    return saving ? (
        <div>
            Saving...
        </div>
    ) : (
        <RenameFileEditor
            className='scenarioEditor'
            metadata={props.metadata}
            onClose={props.onClose}
            getSaveMetadata={props.getSaveMetadata}
            controls={[
                props.newFile ? (
                    <p key='newScenarioInfo'>Your current tabletop layout will be saved in this scenario. To update
                        the scenario later after making further changes to the tabletop, "Edit" the scenario and
                        click the button which will appear on this screen.</p>
                ) : (
                    <InputButton type='button' key='saveScenarioOverButton' onChange={() => {
                        const [privateScenario] = scenarioToJson(props.scenario);
                        setSaving(true);
                        return fileAPI.saveJsonToFile(props.metadata.id, privateScenario)
                            .then(() => {
                                setSaving(false);
                                props.onClose();
                            });
                    }}>Save current tabletop over this scenario</InputButton>
                )
            ]}
        >
            {
                !fileScenario ? 'Loading Preview...' : (
                    <TabletopPreviewComponent
                        scenario={fileScenario}
                        dispatch={scenarioDispatch}
                    />
                )
            }
        </RenameFileEditor>
    );
}

export default ScenarioFileEditor;