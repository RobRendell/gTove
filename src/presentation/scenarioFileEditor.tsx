import * as React from 'react';
import {connect} from 'react-redux';
import {ThunkAction} from 'redux-thunk';
import {AnyAction} from 'redux';
import * as PropTypes from 'prop-types';

import {default as RenameFileEditor, RenameFileEditorProps} from './renameFileEditor';
import {jsonToScenarioAndTabletop, scenarioToJson, ScenarioType} from '../util/scenarioUtils';
import {getAllFilesFromStore, getScenarioFromStore, ReduxStoreType} from '../redux/mainReducer';
import {FileAPIContext} from '../util/storage/storageContract';
import InputButton from './inputButton';
import TabletopPreviewComponent from './tabletopPreviewComponent';
import {FileIndexReducerType} from '../redux/fileIndexReducer';
import {settableScenarioReducer, ScenarioReducerActionTypes} from '../redux/scenarioReducer';

import './scenarioFileEditor.scss';

interface ScenarioFileEditorProps extends RenameFileEditorProps<void, void> {
    scenario: ScenarioType;
    newFile: boolean;
    files: FileIndexReducerType;
}

interface ScenarioFileEditorState {
    saving: boolean;
    fileScenario?: ScenarioType;
}

class ScenarioFileEditor extends React.Component<ScenarioFileEditorProps, ScenarioFileEditorState> {

    static contextTypes = {
        fileAPI: PropTypes.object
    };

    context: FileAPIContext;

    constructor(props: ScenarioFileEditorProps) {
        super(props);
        this.scenarioDispatch = this.scenarioDispatch.bind(this);
        this.state = {
            saving: false
        };
    }

    async componentDidMount() {
        const json = await this.context.fileAPI.getJsonFileContents(this.props.metadata);
        const [fileScenario] = jsonToScenarioAndTabletop(json as any, this.props.files.fileMetadata);
        this.setState({fileScenario});
    }

    private scenarioDispatch(action: AnyAction | ThunkAction<void, ReduxStoreType, {}, AnyAction>) {
        // If the tabletopPreviewComponent updates the scenario metadata, we need to update our state.
        if (typeof(action) !== 'function' && this.state.fileScenario &&
                ((action.type === ScenarioReducerActionTypes.UPDATE_MINI_ACTION && action.mini.metadata) ||
                (action.type === ScenarioReducerActionTypes.UPDATE_MAP_ACTION && action.map.metadata))) {
            const fileScenario = settableScenarioReducer(this.state.fileScenario, action);
            this.setState({fileScenario});
        }
    }

    render() {
        return this.state.saving ? (
            <div>
                Saving...
            </div>
        ) : (
            <RenameFileEditor
                className='scenarioEditor'
                metadata={this.props.metadata}
                onClose={this.props.onClose}
                getSaveMetadata={this.props.getSaveMetadata}
                controls={[
                    this.props.newFile ? (
                        <p key='newScenarioInfo'>Your current tabletop layout will be saved in this scenario.  To update
                            the scenario later after making further changes to the tabletop, "Edit" the scenario and
                            click the button which will appear on this screen.</p>
                    ) : (
                        <InputButton type='button' key='saveScenarioOverButton' onChange={() => {
                            const [privateScenario] = scenarioToJson(this.props.scenario);
                            this.setState({saving: true});
                            return this.context.fileAPI.saveJsonToFile(this.props.metadata.id, privateScenario)
                                .then(() => {
                                    this.setState({saving: false});
                                    this.props.onClose();
                                });
                        }}>Save current tabletop over this scenario</InputButton>
                    )
                ]}
            >
                {
                    !this.state.fileScenario ? 'Loading Preview...' : (
                        <TabletopPreviewComponent
                            scenario={this.state.fileScenario}
                            dispatch={this.scenarioDispatch}
                        />
                    )
                }
            </RenameFileEditor>
        )
    }
}

function mapStoreToProps(store: ReduxStoreType) {
    return {
        scenario: getScenarioFromStore(store),
        files: getAllFilesFromStore(store)
    }
}

export default connect(mapStoreToProps)(ScenarioFileEditor);