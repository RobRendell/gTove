import './tabletopPreviewComponent.scss';

import {FunctionComponent, useEffect, useMemo} from 'react';
import {Provider, useSelector} from 'react-redux';
import {applyMiddleware, createStore, Store} from 'redux';
import createSagaMiddleware from 'redux-saga';
import thunk from 'redux-thunk';
import {Vector3} from 'three';

import CameraParametersContextBridge from '../context/cameraParametersContextBridge';
import {FileIndexActionTypes} from '../redux/fileIndexReducerTypes';
import mainReducer, {getTabletopStateFromStore} from '../redux/mainReducer';
import {GtoveDispatchProp, ReduxStoreType} from '../redux/mainReducerTypes';
import {setScenarioAction} from '../redux/scenarioReducer';
import {ScenarioReducerActionTypes} from '../redux/scenarioReducerTypes';
import scenarioSaga from '../redux/scenarioSaga';
import {setTabletopStateFocusMapIdAction, setTabletopStateTopDownAction} from '../redux/tabletopStateReducer';
import {getHighestMapId, ScenarioType} from '../util/scenarioUtils';
import TabletopViewComponent from './tabletopViewComponent';

interface TabletopPreviewComponentProps extends Partial<GtoveDispatchProp> {
    scenario: ScenarioType;
    readOnly?: boolean;
    playerView?: boolean;
    cameraPosition?: Vector3;
    cameraLookAt?: Vector3;
    cameraAnimation?: number;
    topDown?: boolean;
    topDownChanged?: (isTopDown: boolean) => void;
    extraDispatchActions?: string[];
}

const TabletopPreviewComponent: FunctionComponent<TabletopPreviewComponentProps> = ({
                                                                                        dispatch,
                                                                                        scenario,
                                                                                        readOnly = true,
                                                                                        playerView = false,
                                                                                        cameraPosition,
                                                                                        cameraLookAt,
                                                                                        cameraAnimation,
                                                                                        topDown,
                                                                                        topDownChanged,
                                                                                        extraDispatchActions,
                                                                                    }) => {
    const focusMapId = useMemo(() => (
        getHighestMapId(scenario.maps)
    ), [scenario.maps]);

    const dispatchActions = useMemo(() => ([
        FileIndexActionTypes.ADD_FILES_ACTION,
        FileIndexActionTypes.UPDATE_FILE_ACTION,
        ScenarioReducerActionTypes.SET_SCENARIO_ACTION,
        setTabletopStateTopDownAction.type,
        setTabletopStateFocusMapIdAction.type,
        ...(extraDispatchActions ?? [])
    ]), [extraDispatchActions])

    // Create a Redux store with a selective dispatch.
    const wrappedStore = useMemo<Store<ReduxStoreType>>(() => {

        const sagaMiddleware = createSagaMiddleware();
        const store = createStore(
            mainReducer,
            {myPeerId: 'preview-peer-id'},
            applyMiddleware(sagaMiddleware, thunk)
        );
        sagaMiddleware.run(scenarioSaga);

        return {
            ...store,
            // Use the store's dispatch for file-loading-related actions, otherwise use the prop dispatch (if any)
            dispatch: (action) => (
                (typeof(action) !== 'function' && dispatchActions.includes(action.type))
                    ? store.dispatch(action) : (dispatch?.(action) ?? action)
            )
        }
    }, [dispatch, dispatchActions]);

    // Update the store with any provided state
    useEffect(() => {
        wrappedStore.dispatch(setScenarioAction(scenario, 'hack'));
    }, [scenario, wrappedStore]);
    useEffect(() => {
        if (topDown !== undefined) {
            wrappedStore.dispatch(setTabletopStateTopDownAction(topDown));
        }
    }, [topDown, wrappedStore]);
    useEffect(() => {
        wrappedStore.dispatch(setTabletopStateFocusMapIdAction(focusMapId));
    }, [focusMapId, wrappedStore]);
    
    return (
        <div className='previewPanel'>
            <Provider store={wrappedStore}>
                <CameraParametersContextBridge controlledCameraPosition={cameraPosition}
                                               controlledCameraLookAt={cameraLookAt}
                                               controlledCameraAnimation={cameraAnimation}
                >
                    <TopDownWatcher onTopDownChanged={topDownChanged}/>
                    <TabletopViewComponent
                        snapToGrid={true}
                        readOnly={readOnly}
                        userIsGM={true}
                        playerView={playerView}
                        labelSize={0.4}
                        findPositionForNewMini={() => ({x: 0, y: 0, z: 0})}
                        findUnusedMiniName={() => (['', 0])}
                        disableTapMenu={true}
                    />
                </CameraParametersContextBridge>
            </Provider>
        </div>
    );
};

export default TabletopPreviewComponent;

interface TopDownWatcherProps {
    onTopDownChanged?: (isTopDown: boolean) => void;
}

const TopDownWatcher: FunctionComponent<TopDownWatcherProps> = ({onTopDownChanged}) => {
    const {topDown} = useSelector(getTabletopStateFromStore);
    useEffect(() => {
        onTopDownChanged?.(topDown);
    }, [onTopDownChanged, topDown]);
    return null;
}