import * as React from 'react';
import {connect} from 'react-redux';

import {default as RenameFileEditor, RenameFileEditorProps} from './renameFileEditor';
import {scenarioToJson, ScenarioType} from '../util/scenarioUtils';
import {getScenarioFromStore, ReduxStoreType} from '../redux/mainReducer';
import * as PropTypes from 'prop-types';
import {FileAPIContext} from '../util/fileUtils';
import InputButton from './inputButton';

interface ScenarioFileEditorProps extends RenameFileEditorProps {
    scenario: ScenarioType;
    newFile: boolean;
}

interface ScenarioFileEditorState {
    saving: boolean;
}

class ScenarioFileEditor extends React.Component<ScenarioFileEditorProps, ScenarioFileEditorState> {

    static contextTypes = {
        fileAPI: PropTypes.object
    };

    context: FileAPIContext;

    constructor(props: ScenarioFileEditorProps) {
        super(props);
        this.state = {
            saving: false
        };
    }

    render() {
        return this.state.saving ? (
            <div>
                Saving...
            </div>
        ) : (
            <RenameFileEditor
                metadata={this.props.metadata}
                onClose={this.props.onClose}
                getSaveMetadata={this.props.getSaveMetadata}
                controls={[
                    this.props.newFile ? (
                        <p key='newScenarioInfo'>Your current tabletop layout will be saved in this scenario.  To update
                            the scenario later after making further changes to the tabletop, "Edit" the scenario and
                            click the button which will appear in this screen.</p>
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
            />
        )
    }
}

function mapStoreToProps(store: ReduxStoreType) {
    return {
        scenario: getScenarioFromStore(store)
    }
}

export default connect(mapStoreToProps)(ScenarioFileEditor);