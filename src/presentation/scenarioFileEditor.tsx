import './scenarioFileEditor.scss';

import {FunctionComponent, useCallback, useContext, useState} from 'react';
import {useStore} from 'react-redux';

import {FileAPIContextObject} from '../context/fileAPIProvider';
import {useAsyncSetter} from '../hooks/useAsyncSetter';
import {getAllFilesFromStore, getScenarioFromStore} from '../redux/mainReducer';
import {jsonToScenarioAndTabletop, scenarioToJson, ScenarioType} from '../util/scenarioUtils';
import InputButton from './inputButton';
import {default as RenameFileEditor, RenameFileEditorProps} from './renameFileEditor';
import TabletopPreviewComponent from './tabletopPreviewComponent';

interface ScenarioFileEditorProps extends RenameFileEditorProps<void, void> {
    newFile: boolean;
}

const ScenarioFileEditor: FunctionComponent<ScenarioFileEditorProps> = ({
                                                                            metadata,
                                                                            onClose,
                                                                            getSaveMetadata,
                                                                            newFile
                                                                        }) => {
    const fileAPI = useContext(FileAPIContextObject);
    const store = useStore();

    const [saving, setSaving] = useState(false);
    const [fileScenario, setFileScenario] = useState<ScenarioType | undefined>();

    useAsyncSetter(setFileScenario, async () => {
        const json = await fileAPI.getJsonFileContents(metadata);
        const {fileMetadata} = getAllFilesFromStore(store.getState());
        const [fileScenario] = jsonToScenarioAndTabletop(json as any, fileMetadata);
        return fileScenario;
    }, [], [fileAPI, metadata, store]);

    const onSave = useCallback(() => {
        const scenario = getScenarioFromStore(store.getState());
        const [privateScenario] = scenarioToJson(scenario);
        setSaving(true);
        return fileAPI.saveJsonToFile(metadata.id, privateScenario)
            .then(() => {
                setSaving(false);
                onClose();
            });
    }, [fileAPI, metadata.id, onClose, store]);

    return saving ? (
        <div>
            Saving...
        </div>
    ) : (
        <RenameFileEditor
            className='scenarioEditor'
            metadata={metadata}
            onClose={onClose}
            getSaveMetadata={getSaveMetadata}
            controls={[
                newFile ? (
                    <p key='newScenarioInfo'>Your current tabletop layout will be saved in this scenario. To update
                        the scenario later after making further changes to the tabletop, "Edit" the scenario and
                        click the button which will appear on this screen.</p>
                ) : (
                    <InputButton type='button' key='saveScenarioOverButton' onChange={onSave}>
                        Save current tabletop over this scenario
                    </InputButton>
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