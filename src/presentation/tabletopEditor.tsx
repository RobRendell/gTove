import * as React from 'react';
import * as PropTypes from 'prop-types';
import Select from 'react-select';
import {connect, Dispatch} from 'react-redux';

import RenameFileEditor, {RenameFileEditorProps} from './renameFileEditor';
import {FileAPIContext} from '../util/fileUtils';
import {DistanceMode, DistanceRound, ScenarioType, jsonToScenarioAndTabletop, TabletopType} from '../util/scenarioUtils';
import {DriveMetadata} from '../util/googleDriveUtils';
import {getAllFilesFromStore, getTabletopIdFromStore, ReduxStoreType} from '../redux/mainReducer';
import {updateTabletopAction} from '../redux/tabletopReducer';
import InputField from './inputField';
import {FileIndexReducerType} from '../redux/fileIndexReducer';

import 'react-select/dist/react-select.css';
import './tabletopEditor.css';

interface TabletopEditorProps extends RenameFileEditorProps {
    files: FileIndexReducerType;
    dispatch: Dispatch<ReduxStoreType>;
    tabletopId: string;
}

interface TabletopEditorState {
    tabletop: TabletopType | null;
}

class TabletopEditor extends React.Component<TabletopEditorProps, TabletopEditorState> {

    static contextTypes = {
        fileAPI: PropTypes.object
    };

    static distanceModeStrings = {
        [DistanceMode.STRAIGHT]: 'along a straight line',
        [DistanceMode.GRID_DIAGONAL_ONE_ONE]: 'following the grid, diagonals cost one square',
        [DistanceMode.GRID_DIAGONAL_THREE_EVERY_TWO]: 'following the grid, diagonals cost three squares every two'
    };

    static distanceRoundStrings = {
        [DistanceRound.ROUND_OFF]: 'rounded off',
        [DistanceRound.ROUND_UP]: 'rounded up',
        [DistanceRound.ROUND_DOWN]: 'rounded down',
        [DistanceRound.ONE_DECIMAL]: 'shown to one decimal place'
    };

    context: FileAPIContext;

    constructor(props: TabletopEditorProps) {
        super(props);
        this.onSave = this.onSave.bind(this);
        this.state = {
            tabletop: null
        };
    }

    componentDidMount() {
        this.context.fileAPI.getJsonFileContents(this.props.metadata)
            .then((combined: ScenarioType & TabletopType) => {
                const [, tabletop] = jsonToScenarioAndTabletop(combined, this.props.files.driveMetadata);
                this.setState({tabletop});
            });
    }

    onSave(gmFileMetadata: DriveMetadata): Promise<any> {
        if (this.state.tabletop && this.props.metadata.id === this.props.tabletopId) {
            // If current, can just dispatch Redux actions to update the tabletop live.
            this.props.dispatch(updateTabletopAction(this.state.tabletop));
            return Promise.resolve();
        } else {
            // Otherwise, merge changes with public and private tabletop files.
            return this.context.fileAPI.getJsonFileContents(this.props.metadata)
                .then((combined) => (
                    this.context.fileAPI.saveJsonToFile(this.props.metadata.id, {...combined, ...this.state.tabletop, gmSecret: undefined})
                ))
                .then(() => (this.context.fileAPI.getJsonFileContents(gmFileMetadata)))
                .then((combined) => (
                    this.context.fileAPI.saveJsonToFile(gmFileMetadata.id, {...combined, ...this.state.tabletop})
                ));
        }
    }

    renderSelect<E>(enumObject: E, labels: {[key in keyof E]: string}, field: string, defaultValue: keyof E) {
        return (
            <Select
                options={Object.keys(enumObject).map((key) => ({label: labels[key], value: enumObject[key]}))}
                value={this.state.tabletop![field] || defaultValue}
                clearable={false}
                onChange={(selection) => {
                    if (selection && !Array.isArray(selection) && selection.value) {
                        this.setState((state) => ({tabletop: {...state.tabletop!, [field]: selection.value}}));
                    }
                }}
            />
        );
    }

    render() {
        return (
            <RenameFileEditor
                className='tabletopEditor'
                metadata={this.props.metadata}
                onClose={this.props.onClose}
                getSaveMetadata={() => ({})}
                onSave={this.onSave}
            >
                {
                    !this.state.tabletop ? (
                        <span>Loading...</span>
                    ) : (
                        <div>
                            <fieldset>
                                <legend>Tabletop grid distances</legend>
                                <div className='gridScaleDiv'>
                                    <label>One grid square is</label>
                                    <InputField type='number' initialValue={this.state.tabletop.gridScale || ''} onChange={(value) => {
                                        this.setState({tabletop: {...this.state.tabletop!, gridScale: Number(value) || undefined}});
                                    }}
                                    />
                                    <InputField type='text' initialValue={this.state.tabletop.gridUnit || ''} onChange={(value) => {
                                        this.setState({tabletop: {...this.state.tabletop!, gridUnit: String(value) || undefined}});
                                    }} placeholder='Units e.g. foot/feet, meter/meters'
                                    />
                                </div>
                                <div className='gridDiagonalDiv'>
                                    <label>Measure distance</label>
                                    {this.renderSelect(DistanceMode, TabletopEditor.distanceModeStrings, 'distanceMode', DistanceMode.STRAIGHT)}
                                </div>
                                <div className='gridRoundDiv'>
                                    <label>Distances are</label>
                                    {this.renderSelect(DistanceRound, TabletopEditor.distanceRoundStrings, 'distanceRound', DistanceRound.ROUND_OFF)}
                                </div>
                            </fieldset>
                        </div>
                    )
                }
            </RenameFileEditor>
        );
    }
}

function mapStoreToProps(store: ReduxStoreType) {
    return {
        tabletopId: getTabletopIdFromStore(store),
        files: getAllFilesFromStore(store)
    };
}

export default connect(mapStoreToProps)(TabletopEditor);