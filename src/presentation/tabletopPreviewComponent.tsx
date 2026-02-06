import {Component} from 'react';
import {AnyAction} from 'redux';
import {connect} from 'react-redux';
import {ThunkAction, ThunkDispatch} from 'redux-thunk';
import * as THREE from 'three';

import TabletopViewComponent from './tabletopViewComponent';
import {getBaseCameraParameters, getHighestMapId, ScenarioType} from '../util/scenarioUtils';
import {initialTabletopReducerState} from '../redux/tabletopReducer';
import {getAllFilesFromStore, GtoveDispatchProp, ReduxStoreType} from '../redux/mainReducer';
import {VirtualGamingTabletopCameraState} from './virtualGamingTabletop';
import * as constants from '../util/constants';
import {FileIndexActionTypes, FileIndexReducerType} from '../redux/fileIndexReducer';
import {initialPaintState} from './paintTools';

import './tabletopPreviewComponent.scss';

const defaultProps = {
    readOnly: true,
    playerView: false
};

type TabletopPreviewComponentDefaultProps = Readonly<typeof defaultProps>;

interface TabletopPreviewComponentOwnProps extends Partial<GtoveDispatchProp> {
    scenario: ScenarioType;
    topDownChanged?: (isTopDown: boolean) => void;
    cameraLookAt?: THREE.Vector3;
    cameraPosition?: THREE.Vector3;
}

interface TabletopPreviewComponentStoreProps {
    files: FileIndexReducerType;
}

interface TabletopPreviewComponentDispatchProps {
    wrappedDispatch: ThunkDispatch<ReduxStoreType, {}, AnyAction>;
}

type TabletopPreviewComponentProps = TabletopPreviewComponentOwnProps & TabletopPreviewComponentDefaultProps
    & TabletopPreviewComponentStoreProps & TabletopPreviewComponentDispatchProps;

interface TabletopPreviewComponentState extends VirtualGamingTabletopCameraState {
    isTopDown: boolean;
}

class TabletopPreviewComponent extends Component<TabletopPreviewComponentProps, TabletopPreviewComponentState> {

    static defaultProps = defaultProps;

    static DIR_DOWN = new THREE.Vector3(0, -1, 0);

    static NO_OP = () => {};

    constructor(props: TabletopPreviewComponentProps) {
        super(props);
        this.setCameraParameters = this.setCameraParameters.bind(this);
        const focusMapId = getHighestMapId(props.scenario.maps);
        const baseCameraParameters = getBaseCameraParameters(focusMapId ? props.scenario.maps[focusMapId] : undefined);
        const cameraLookAt = props.cameraLookAt || baseCameraParameters.cameraLookAt;
        const cameraPosition = props.cameraPosition || baseCameraParameters.cameraPosition;
        this.state = {
            cameraPosition,
            cameraLookAt,
            isTopDown: this.isTopDown(cameraLookAt, cameraPosition)
        };
    }

    private focusMapHasWidthHeight(props: TabletopPreviewComponentProps) {
        const focusMapId = getHighestMapId(props.scenario.maps);
        return (focusMapId && props.scenario.maps[focusMapId] && props.scenario.maps[focusMapId]?.metadata
            && props.scenario.maps[focusMapId]?.metadata?.properties
            && props.scenario.maps[focusMapId]?.metadata?.properties?.width
            && props.scenario.maps[focusMapId]?.metadata?.properties?.height) ? focusMapId : undefined;
    }

    UNSAFE_componentWillReceiveProps(nextProps: TabletopPreviewComponentProps): void {
        if (nextProps.cameraPosition && nextProps.cameraLookAt &&
            (this.props.cameraPosition !== nextProps.cameraPosition || this.props.cameraLookAt !== nextProps.cameraLookAt)) {
            this.setCameraParameters({cameraPosition: nextProps.cameraPosition, cameraLookAt: nextProps.cameraLookAt})
        }
        let focusMapId;
        if (!this.focusMapHasWidthHeight(this.props) && (focusMapId = this.focusMapHasWidthHeight(nextProps))) {
            this.setState(getBaseCameraParameters(nextProps.scenario.maps[focusMapId]));
        }
    }

    private isTopDown(cameraLookAt: THREE.Vector3, cameraPosition: THREE.Vector3) {
        const offset = cameraLookAt.clone().sub(cameraPosition).normalize();
        return (offset.dot(TabletopPreviewComponent.DIR_DOWN) > constants.TOPDOWN_DOT_PRODUCT);
    }

    setCameraParameters(cameraParameters: Partial<VirtualGamingTabletopCameraState>) {
        const cameraPosition = cameraParameters.cameraPosition || this.state.cameraPosition;
        const cameraLookAt = cameraParameters.cameraLookAt || this.state.cameraLookAt;
        const isTopDown = this.isTopDown(cameraLookAt, cameraPosition);
        if (isTopDown !== this.state.isTopDown && this.props.topDownChanged) {
            this.props.topDownChanged(isTopDown);
        }
        this.setState({cameraPosition, cameraLookAt, isTopDown});
    }

    render() {
        return (
            <div className='previewPanel'>
                <TabletopViewComponent
                    scenario={this.props.scenario}
                    tabletop={initialTabletopReducerState}
                    fullDriveMetadata={this.props.files.fileMetadata}
                    dispatch={this.props.wrappedDispatch}
                    cameraPosition={this.state.cameraPosition}
                    cameraLookAt={this.state.cameraLookAt}
                    setCamera={this.setCameraParameters}
                    focusMapId={getHighestMapId(this.props.scenario.maps)}
                    setFocusMapId={TabletopPreviewComponent.NO_OP}
                    readOnly={this.props.readOnly}
                    fogOfWarMode={false}
                    endFogOfWarMode={TabletopPreviewComponent.NO_OP}
                    measureDistanceMode={false}
                    endMeasureDistanceMode={TabletopPreviewComponent.NO_OP}
                    elasticBandMode={false}
                    endElasticBandMode={TabletopPreviewComponent.NO_OP}
                    snapToGrid={false}
                    userIsGM={true}
                    playerView={this.props.playerView}
                    labelSize={0.4}
                    findPositionForNewMini={() => ({x: 0, y: 0, z: 0})}
                    findUnusedMiniName={() => (['', 0])}
                    myPeerId='previewTabletop'
                    disableTapMenu={true}
                    paintState={initialPaintState}
                    updatePaintState={TabletopPreviewComponent.NO_OP}
                />
            </div>
        );
    }
}

function mapStoreToProps(store: ReduxStoreType) {
    return {
        files: getAllFilesFromStore(store)
    };
}

function mapDispatchToProps(dispatch: ThunkDispatch<ReduxStoreType, {}, AnyAction>, ownProps: TabletopPreviewComponentOwnProps) {
    return {
        dispatch,
        wrappedDispatch: (action: AnyAction | ThunkAction<void, ReduxStoreType, {}, AnyAction>) => {
            // Use the real dispatch for file-loading-related actions, otherwise use the user-supplied one
            if (typeof(action) !== 'function' && (action.type === FileIndexActionTypes.ADD_FILES_ACTION || action.type === FileIndexActionTypes.UPDATE_FILE_ACTION)) {
                dispatch(action);
            } else if (ownProps.dispatch) {
                ownProps.dispatch(action as any);
            }
        }
    }
}

export default connect(mapStoreToProps, mapDispatchToProps)(TabletopPreviewComponent);