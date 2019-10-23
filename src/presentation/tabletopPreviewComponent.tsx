import React, {Component} from 'react';
import {AnyAction, Dispatch} from 'redux';
import {connect} from 'react-redux';
import {ThunkAction} from 'redux-thunk';
import * as THREE from 'three';

import TabletopViewComponent from './tabletopViewComponent';
import {ScenarioType, TabletopType} from '../util/scenarioUtils';
import {getAllFilesFromStore, ReduxStoreType} from '../redux/mainReducer';
import {VirtualGamingTabletopCameraState} from './virtualGamingTabletop';
import * as constants from '../util/constants';
import {FileIndexActionTypes, FileIndexReducerType} from '../redux/fileIndexReducer';

import './tabletopPreviewComponent.scss';

const defaultProps = {
    readOnly: true,
    playerView: false,
    cameraLookAt: new THREE.Vector3(),
    cameraPosition: new THREE.Vector3(0, 12, 12)
};

type TabletopPreviewComponentDefaultProps = Readonly<typeof defaultProps>;

interface TabletopPreviewComponentOwnProps {
    scenario: ScenarioType;
    dispatch?: Dispatch<AnyAction, ReduxStoreType>;
    topDownChanged?: (isTopDown: boolean) => void;
}

interface TabletopPreviewComponentStoreProps {
    files: FileIndexReducerType;
}

interface TabletopPreviewComponentDispatchProps {
    dispatch: Dispatch<AnyAction, ReduxStoreType>;
    wrappedDispatch: Dispatch<AnyAction, ReduxStoreType>;
}

type TabletopPreviewComponentProps = TabletopPreviewComponentOwnProps & TabletopPreviewComponentDefaultProps
    & TabletopPreviewComponentStoreProps & TabletopPreviewComponentDispatchProps;

interface TabletopPreviewComponentState extends VirtualGamingTabletopCameraState {
    isTopDown: boolean;
}

class TabletopPreviewComponent extends Component<TabletopPreviewComponentProps, TabletopPreviewComponentState> {

    static defaultProps = defaultProps;

    static DIR_DOWN = new THREE.Vector3(0, -1, 0);

    constructor(props: TabletopPreviewComponentProps) {
        super(props);
        this.setCameraParameters = this.setCameraParameters.bind(this);
        this.state = {
            cameraLookAt: props.cameraLookAt.clone(),
            cameraPosition: props.cameraPosition.clone(),
            isTopDown: this.isTopDown(props.cameraLookAt, props.cameraPosition)
        };
    }

    componentWillReceiveProps(nextProps: TabletopPreviewComponentProps): void {
        if (!this.props.cameraPosition.equals(nextProps.cameraPosition) || !this.props.cameraLookAt.equals(nextProps.cameraLookAt)) {
            this.setCameraParameters({cameraPosition: nextProps.cameraPosition, cameraLookAt: nextProps.cameraLookAt})
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
                    tabletop={{gm: ''} as TabletopType}
                    fullDriveMetadata={this.props.files.driveMetadata}
                    dispatch={this.props.wrappedDispatch}
                    cameraPosition={this.state.cameraPosition}
                    cameraLookAt={this.state.cameraLookAt}
                    setCamera={this.setCameraParameters}
                    setFocusMapId={() => {}}
                    readOnly={this.props.readOnly}
                    fogOfWarMode={false}
                    endFogOfWarMode={() => {}}
                    snapToGrid={false}
                    userIsGM={true}
                    playerView={this.props.playerView}
                    labelSize={0.4}
                    findPositionForNewMini={() => ({x: 0, y: 0, z: 0})}
                    findUnusedMiniName={() => (['', 0])}
                    myPeerId='previewTabletop'
                    disableTapMenu={true}
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

function mapDispatchToProps(dispatch: Dispatch<AnyAction, ReduxStoreType>, ownProps: TabletopPreviewComponentOwnProps) {
    return {
        dispatch,
        wrappedDispatch: (action: AnyAction | ThunkAction<void, ReduxStoreType, void>) => {
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