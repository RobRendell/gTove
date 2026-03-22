import './tabletopPreviewComponent.scss';

import {FunctionComponent, useCallback, useMemo, useState} from 'react';
import {Provider, useSelector} from 'react-redux';
import {applyMiddleware, createStore, Store} from 'redux';
import createSagaMiddleware from 'redux-saga';
import thunk from 'redux-thunk';
import * as THREE from 'three';

import {FileIndexActionTypes} from '../redux/fileIndexReducerTypes';
import mainReducer, {getAllFilesFromStore} from '../redux/mainReducer';
import {GtoveDispatchProp, ReduxStoreType} from '../redux/mainReducerTypes';
import scenarioSaga from '../redux/scenarioSaga';
import {getBaseCameraParameters, getHighestMapId, ScenarioType} from '../util/scenarioUtils';
import {isTopDown} from '../util/threeUtils';
import TabletopViewComponent from './tabletopViewComponent';
import {VirtualGamingTabletopCameraState} from './virtualGamingTabletop';

const NO_OP = () => {};

interface TabletopPreviewComponentProps extends Partial<GtoveDispatchProp> {
    scenario: ScenarioType;
    topDownChanged?: (isTopDown: boolean) => void;
    cameraLookAt?: THREE.Vector3;
    cameraPosition?: THREE.Vector3;
    readOnly?: boolean;
    playerView?: boolean;
}

const TabletopPreviewComponent: FunctionComponent<TabletopPreviewComponentProps> = ({
                                                                                        dispatch,
                                                                                        scenario,
                                                                                        topDownChanged,
                                                                                        cameraPosition,
                                                                                        cameraLookAt,
                                                                                        readOnly = true,
                                                                                        playerView = false
                                                                                    }) => {
    const focusMapId = useMemo(() => (
        getHighestMapId(scenario.maps)
    ), [scenario.maps]);
    const initialCameraState = useMemo(() => {
        const baseParams = getBaseCameraParameters(focusMapId ? scenario.maps[focusMapId] : undefined);
        return {
            cameraPosition: cameraPosition ?? baseParams.cameraPosition,
            cameraLookAt: cameraLookAt ?? baseParams.cameraLookAt
        }
    }, [cameraLookAt, cameraPosition, focusMapId, scenario.maps]);
    const [cameraState, setCameraState] = useState(initialCameraState);

    const [, setTopDown] = useState(false);
    const setCameraParameters = useCallback((cameraParameters: Partial<VirtualGamingTabletopCameraState>) => {
        const newCameraPosition = cameraParameters.cameraPosition || cameraState.cameraPosition;
        const newCameraLookAt = cameraParameters.cameraLookAt || cameraState.cameraLookAt;
        const newTopDown = isTopDown(newCameraLookAt, newCameraPosition);
        setTopDown((topDown) => {
            if (newTopDown !== topDown) {
                topDownChanged?.(newTopDown);
            }
            return newTopDown;
        });
        setCameraState({cameraPosition: newCameraPosition, cameraLookAt: newCameraLookAt})
    }, [cameraState.cameraLookAt, cameraState.cameraPosition, topDownChanged]);

    const fileIndex = useSelector(getAllFilesFromStore);

    // Create a Redux store initialised with the provided scenario, but with a selective dispatch.
    const wrappedStore = useMemo<Store<ReduxStoreType>>(() => {

        const sagaMiddleware = createSagaMiddleware();
        const store = createStore(
            mainReducer,
            {undoableState: {present: {scenario}}, fileIndex, myPeerId: 'preview-peer-id'},
            applyMiddleware(sagaMiddleware, thunk)
        );
        sagaMiddleware.run(scenarioSaga);
        
        return {
            ...store,
            // Use the store's dispatch for file-loading-related actions, otherwise use the prop dispatch (if any)
            dispatch: (action) => (
                (typeof(action) !== 'function' && (
                    action.type === FileIndexActionTypes.ADD_FILES_ACTION || action.type === FileIndexActionTypes.UPDATE_FILE_ACTION
                )) ? store.dispatch(action) : (dispatch?.(action) ?? action)
            )
        }
    }, [dispatch, fileIndex, scenario]);

    return (
        <div className='previewPanel'>
            <Provider store={wrappedStore}>
                <TabletopViewComponent
                    setCamera={setCameraParameters}
                    cameraPosition={cameraState.cameraPosition}
                    cameraLookAt={cameraState.cameraLookAt}
                    snapToGrid={true}
                    focusMapId={focusMapId}
                    setFocusMapId={NO_OP}
                    readOnly={readOnly}
                    userIsGM={true}
                    playerView={playerView}
                    labelSize={0.4}
                    findPositionForNewMini={() => ({x: 0, y: 0, z: 0})}
                    findUnusedMiniName={() => (['', 0])}
                    myPeerId='previewTabletop'
                    disableTapMenu={true}
                />
            </Provider>
        </div>
    );
};

export default TabletopPreviewComponent;