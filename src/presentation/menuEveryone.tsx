import './menuEveryone.scss';

import copyToClipboard from 'copy-to-clipboard';
import {FunctionComponent, useCallback} from 'react';
import {shallowEqual, useDispatch, useSelector, useStore} from 'react-redux';
import {toast} from 'react-toastify';

import {useCameraParameters} from '../context/cameraParametersProvider';
import {
    getLoggedInUserFromStore,
    getScenarioFromStore,
    getTabletopFromStore,
    getTabletopStateFromStore
} from '../redux/mainReducer';
import {ReduxStoreType} from '../redux/mainReducerTypes';
import {
    setTabletopStateDiceBagOpenAction,
    setTabletopStateFullScreenAction,
    setTabletopStateShowPiecesRosterAction,
    toggleTabletopStateDragModeAction
} from '../redux/tabletopStateReducer';
import {DragModeType} from '../redux/tabletopStateReducerTypes';
import {getMapIdClosestToZero, getMapIdOnNextLevel, isMapIdHighest, isMapIdLowest} from '../util/scenarioUtils';
import InputButton from './inputButton';
import LabelSizeSlider from './labelSizeSlider';

export interface MenuEveryoneProps {
    labelSize: number;
    setLabelSize: (value: number) => void;
}

const MenuEveryone: FunctionComponent<MenuEveryoneProps> = ({labelSize, setLabelSize,}) => {
    const {dragMode, fullScreen} = useSelector(getTabletopStateFromStore);
    const dispatch = useDispatch();
    const store = useStore();
    const {setCameraParameters, getDefaultCameraFocus, setFocusMapId} = useCameraParameters();
    const {disableUp, disableDown} = useSelector(selectDisableUpDown, shallowEqual);

    const changeFocusLevel = useCallback((direction: 1 | -1) => {
        const scenario = getScenarioFromStore(store.getState());
        const {focusMapId} = getTabletopStateFromStore(store.getState());
        const levelMapId = getMapIdOnNextLevel(direction, scenario.maps, focusMapId, false);
        setFocusMapId(levelMapId, null);
    }, [setFocusMapId, store]);
    
    const toggleDragMode = useCallback((mode: DragModeType) => {
        dispatch(toggleTabletopStateDragModeAction(mode));
    }, [dispatch]);
    return (
        <div>
            <div className='controlsRow'>
                <InputButton type='button' disabled={disableUp}
                             tooltip='Focus the camera on a map at a higher elevation.'
                             onChange={() => {
                                 changeFocusLevel(1);
                             }}>
                    <span className='material-icons'>expand_less</span>
                </InputButton>
                <InputButton type='button' tooltip='Re-focus the camera on the current map.'
                             onChange={() => {
                                 setCameraParameters(getDefaultCameraFocus(), 1000);
                             }}>
                    <span className='material-icons'>videocam</span>
                </InputButton>
                <InputButton type='button' disabled={disableDown}
                             tooltip='Focus the camera on a map at a lower elevation.'
                             onChange={() => {
                                 changeFocusLevel(-1);
                             }}>
                    <span className='material-icons'>expand_more</span>
                </InputButton>
            </div>
            <div className='controlsRow'>
                <LabelSizeSlider labelSize={labelSize} setLabelSize={setLabelSize} />
            </div>
            <div className='controlsRow'>
                <InputButton type='button'
                             tooltip={fullScreen ? 'Exit full-screen mode.' : 'Start full-screen mode.'}
                             onChange={() => {
                                 dispatch(setTabletopStateFullScreenAction(!fullScreen));
                             }}>
                    <span className='material-icons'>{fullScreen ? 'fullscreen_exit' : 'fullscreen'}</span>
                </InputButton>
                <InputButton type='button'
                             tooltip='Copy Tabletop URL to clipboard.'
                             onChange={() => {
                                 copyToClipboard(window.location.href);
                                 toast('Current tabletop URL copied to clipboard.');
                             }}>
                    <span className='material-icons'>share</span>
                </InputButton>
                <InputButton type='button'
                             tooltip={'Open dice bag.'}
                             onChange={() => {
                                 dispatch(setTabletopStateDiceBagOpenAction(true));
                             }}>
                    <span className='material-icons'>casino</span>
                </InputButton>
            </div>
            <div className='controlsRow'>
                <InputButton type='button'
                             tooltip='Open roster of pieces on the tabletop.'
                             onChange={() => {
                                 dispatch(setTabletopStateShowPiecesRosterAction(true));
                             }}>
                    <span className='material-icons'>people</span>
                </InputButton>
                <InputButton type='checkbox'
                             tooltip='Measure distances on the tabletop.'
                             selected={dragMode === 'measureDistanceMode'}
                             toggle={true}
                             onChange={() => {toggleDragMode('measureDistanceMode')}}>
                    <span className='material-icons'>straighten</span>
                </InputButton>
                <InputButton type='checkbox'
                             tooltip='Select and move multiple pieces at once.'
                             selected={dragMode === 'elasticBandMode'}
                             toggle={true}
                             onChange={() => {toggleDragMode('elasticBandMode')}}>
                    <span className='material-icons'>select_all</span>
                </InputButton>
            </div>

        </div>
    )
};

export default MenuEveryone;

function selectDisableUpDown(state: ReduxStoreType) {
    const {focusMapId, playerView} = getTabletopStateFromStore(state);
    const {gm} = getTabletopFromStore(state);
    const loggedInUser = getLoggedInUserFromStore(state);
    const hideGmOnlyMaps = loggedInUser?.emailAddress !== gm || playerView;
    const maps = getScenarioFromStore(state).maps;
    const mapId = focusMapId ?? getMapIdClosestToZero(maps);
    return {
        disableUp: isMapIdHighest(maps, mapId, hideGmOnlyMaps),
        disableDown: isMapIdLowest(maps, mapId, hideGmOnlyMaps)
    };
}
