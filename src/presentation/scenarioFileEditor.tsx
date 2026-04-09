import './scenarioFileEditor.scss';

import {FunctionComponent, useContext, useState} from 'react';
import {useStore} from 'react-redux';

import {FileAPIContextObject} from '../context/fileAPIProvider';
import {useAsyncSetter} from '../hooks/useAsyncSetter';
import {FileIndexReducerType} from '../redux/fileIndexReducerTypes';
import {getAllFilesFromStore} from '../redux/mainReducer';
import {jsonToScenarioAndTabletop, scenarioToJson, ScenarioType} from '../util/scenarioUtils';
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
    const store = useStore();

    const [saving, setSaving] = useState(false);
    const [fileScenario, setFileScenario] = useState<ScenarioType | undefined>();

    useAsyncSetter(setFileScenario, async () => {
        const json = await fileAPI.getJsonFileContents(props.metadata);
        const {fileMetadata} = getAllFilesFromStore(store.getState());
        const [fileScenario] = jsonToScenarioAndTabletop(json as any, fileMetadata);
        return fileScenario;
    }, [], [fileAPI, props.metadata, store]);

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
                    <TabletopPreviewComponent scenario={fileScenario} />
                )
            }
        </RenameFileEditor>
    );
}

export default ScenarioFileEditor;