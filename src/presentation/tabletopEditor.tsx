import * as React from 'react';
import * as PropTypes from 'prop-types';
import ReactDropdown from 'react-dropdown-now';
import {connect} from 'react-redux';
import {randomBytes} from 'crypto';

import RenameFileEditor, {RenameFileEditorProps} from './renameFileEditor';
import {FileAPIContext} from '../util/fileUtils';
import {
    DistanceMode,
    DistanceRound,
    jsonToScenarioAndTabletop,
    ScenarioType,
    TabletopType
} from '../util/scenarioUtils';
import {AnyProperties, DriveMetadata, GridType, TabletopFileAppProperties} from '../util/googleDriveUtils';
import {getAllFilesFromStore, getTabletopIdFromStore, GtoveDispatchProp, ReduxStoreType} from '../redux/mainReducer';
import {updateTabletopAction} from '../redux/tabletopReducer';
import InputField from './inputField';
import {FileIndexReducerType} from '../redux/fileIndexReducer';
import {CommsStyle} from '../util/commsNode';
import InputButton from './inputButton';
import HelpButton from './helpButton';
import PiecesRosterConfiguration from './piecesRosterConfiguration';

import './tabletopEditor.scss';

interface TabletopEditorProps extends RenameFileEditorProps<TabletopFileAppProperties, AnyProperties>, GtoveDispatchProp {
    files: FileIndexReducerType;
    tabletopId: string;
}

interface TabletopEditorState {
    tabletop: TabletopType | null;
}

class TabletopEditor extends React.Component<TabletopEditorProps, TabletopEditorState> {

    static contextTypes = {
        fileAPI: PropTypes.object
    };

    static defaultGridStrings = {
        [GridType.NONE]: undefined,
        [GridType.SQUARE]: 'Squares',
        [GridType.HEX_VERT]: 'Hexagons (Vertical)',
        [GridType.HEX_HORZ]: 'Hexagons (Horizontal)'
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

    static commsStyleStrings = {
        [CommsStyle.PeerToPeer]: 'Peer-to-peer',
        [CommsStyle.MultiCast]: 'Multicast (experimental)'
    };

    context: FileAPIContext;

    constructor(props: TabletopEditorProps) {
        super(props);
        this.onSave = this.onSave.bind(this);
        this.state = {
            tabletop: null
        };
    }

    async componentDidMount() {
        // Need to load the private tabletop to get gmSecret
        const metadataId = this.props.metadata.appProperties.gmFile;
        const combined: ScenarioType & TabletopType = await this.context.fileAPI.getJsonFileContents({id: metadataId});
        const [, tabletop] = jsonToScenarioAndTabletop(combined, this.props.files.driveMetadata);
        if (!tabletop.gmSecret) {
            // since we weren't loading the private tabletop before, the gmSecret may have been lost with previous editing.
            tabletop.gmSecret = randomBytes(48).toString('hex');
        }
        this.setState({tabletop});
    }

    async onSave(gmFileMetadata: DriveMetadata): Promise<void> {
        if (this.state.tabletop && this.props.metadata.id === this.props.tabletopId) {
            // If current, can just dispatch Redux actions to update the tabletop live.
            this.props.dispatch(updateTabletopAction(this.state.tabletop));
        } else {
            // Otherwise, merge changes with public and private tabletop files.
            const combined = await this.context.fileAPI.getJsonFileContents(this.props.metadata);
            await this.context.fileAPI.saveJsonToFile(this.props.metadata.id, {...combined, ...this.state.tabletop, gmSecret: undefined});
            const gmOnly = await this.context.fileAPI.getJsonFileContents(gmFileMetadata);
            await this.context.fileAPI.saveJsonToFile(gmFileMetadata.id, {...gmOnly, ...this.state.tabletop});
        }
    }

    renderEnumSelect<E>(enumObject: E, labels: {[key in keyof E]: string | undefined}, field: string, defaultValue: keyof E) {
        const options = Object.keys(enumObject)
            .filter((key) => (labels[key]))
            .map((key) => ({label: labels[key], value: enumObject[key]}));
        const value = options.find((option) => (option.value === (this.state.tabletop![field] || defaultValue)));
        return (
            <ReactDropdown
                className='select'
                options={options}
                value={value}
                onChange={(selection) => {
                    this.setState((state) => ({tabletop: {...state.tabletop!, [field]: selection.value}}));
                }}
            />
        );
    }

    private updateTabletop(update: Partial<TabletopType>) {
        this.setState({tabletop: {...this.state.tabletop!, ...update}});
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
                                <legend>Tabletop grids</legend>
                                <div className='gridDefault'>
                                    <label>Default grid on tabletop is</label>
                                    {this.renderEnumSelect(GridType, TabletopEditor.defaultGridStrings, 'defaultGrid', GridType.SQUARE)}
                                </div>
                                <div className='gridScaleDiv'>
                                    <label>{this.state.tabletop.defaultGrid === GridType.SQUARE ? 'One grid square is' : 'Distance from one hexagon to the next is'}</label>
                                    <InputField type='number' initialValue={this.state.tabletop.gridScale || 0} onChange={(value) => {
                                        this.updateTabletop({gridScale: Number(value) || undefined});
                                    }}
                                    />
                                    <InputField type='text' initialValue={this.state.tabletop.gridUnit || ''} onChange={(value) => {
                                        this.updateTabletop({gridUnit: String(value) || undefined});
                                    }} placeholder='Units e.g. foot/feet, meter/meters'
                                    />
                                </div>
                                <div className='gridDiagonalDiv'>
                                    <label>Measure distance</label>
                                    {this.renderEnumSelect(DistanceMode, TabletopEditor.distanceModeStrings, 'distanceMode', DistanceMode.STRAIGHT)}
                                </div>
                                <div className='gridRoundDiv'>
                                    <label>Distances are</label>
                                    {this.renderEnumSelect(DistanceRound, TabletopEditor.distanceRoundStrings, 'distanceRound', DistanceRound.ROUND_OFF)}
                                </div>
                            </fieldset>
                            <fieldset>
                                <legend>Permissions</legend>
                                <div className='permissionsDiv'>
                                    <label>Restrict who may connect to this tabletop</label>
                                    <InputButton type='checkbox' selected={this.state.tabletop.tabletopUserControl !== undefined} onChange={() => {
                                        this.updateTabletop({
                                            tabletopUserControl: this.state.tabletop!.tabletopUserControl === undefined
                                                ? {whitelist: [], blacklist: []} : undefined
                                        });
                                    }}/>
                                </div>
                                {
                                    this.state.tabletop && this.state.tabletop.tabletopUserControl === undefined ? null : (
                                        <>
                                            <div>
                                                Enter email addresses (separated by spaces) or * to control who may
                                                connect to this tabletop.
                                                <HelpButton>
                                                    <>
                                                        <p>
                                                            A player whose email address appears on the whitelist is
                                                            allowed to join the tabletop. Anyone with an email address
                                                            on the blacklist will be automatically rejected. Enter the
                                                            wildcard character * to match anyone not on the other
                                                            list... for example, putting * in the blacklist will mean
                                                            no-one other than the emails in the whitelist can join.
                                                        </p>
                                                        <p>
                                                            If a user connects who doesn't match either list, the GM
                                                            will be prompted that such-and-such user is attempting to
                                                            connect, and given options to allow or deny them. The
                                                            whitelist or blacklist will be updated automatically based
                                                            on the response. You can use this to more easily populate
                                                            the whitelist, and then set the blacklist to * to prevent
                                                            anyone else connecting.
                                                        </p>
                                                    </>
                                                </HelpButton>
                                            </div>
                                            <div className='permissionsDiv'>
                                                <label>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Whitelist:</label>
                                                <textarea
                                                    value={this.state.tabletop.tabletopUserControl!.whitelist.join(' ')}
                                                    placeholder='Email addresses of players allowed to join'
                                                    onChange={(evt) => {
                                                        const tabletopUserControl = this.state.tabletop!.tabletopUserControl!;
                                                        this.updateTabletop({
                                                            tabletopUserControl: {
                                                                ...tabletopUserControl,
                                                                whitelist: evt.target.value.split(/,? +/)
                                                            }
                                                        });
                                                    }}
                                                />
                                            </div>
                                            <div className='permissionsDiv'>
                                                <label>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Blacklist:</label>
                                                <textarea
                                                    value={this.state.tabletop.tabletopUserControl!.blacklist.join(' ')}
                                                    placeholder='Email addresses of people who cannot join'
                                                    onChange={(evt) => {
                                                        const tabletopUserControl = this.state.tabletop!.tabletopUserControl!;
                                                        this.updateTabletop({
                                                            tabletopUserControl: {
                                                                ...tabletopUserControl,
                                                                blacklist: evt.target.value.split(/,? +/)
                                                            }
                                                        });
                                                    }}
                                                />
                                            </div>
                                        </>
                                    )
                                }
                                <div className='permissionsDiv'>
                                    <label>Only the GM may ping the map (long-press)</label>
                                    <InputButton type='checkbox' selected={this.state.tabletop.gmOnlyPing} onChange={() => {
                                        this.setState({tabletop: {...this.state.tabletop!, gmOnlyPing: !this.state.tabletop!.gmOnlyPing}});
                                    }}/>
                                </div>
                            </fieldset>
                            <fieldset>
                                <legend>Communication</legend>
                                <div className='commsStyleDiv'>
                                    <label>Client connections</label>
                                    {this.renderEnumSelect(CommsStyle, TabletopEditor.commsStyleStrings, 'commsStyle', CommsStyle.PeerToPeer)}
                                </div>
                            </fieldset>
                            <fieldset>
                                <legend>Pieces Roster Columns</legend>
                                <PiecesRosterConfiguration columns={this.state.tabletop.piecesRosterColumns} setColumns={(piecesRosterColumns) => {
                                    this.setState({tabletop: {...this.state.tabletop!, piecesRosterColumns}})
                                }}/>
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