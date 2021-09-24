import {FunctionComponent} from 'react';
import copyToClipboard from 'copy-to-clipboard';
import {toast} from 'react-toastify';

import './menuEveryone.scss';

import InputButton from './inputButton';
import {isMapIdHighest, isMapIdLowest, ScenarioType} from '../util/scenarioUtils';
import InputField from './inputField';
import {SetCameraFunction, VirtualGamingTabletopCameraState} from './virtualGamingTabletop';
import {DragModeType} from './screenControlPanelAndTabletop';

export interface MenuEveryoneProps {
    scenario: ScenarioType;
    focusMapId?: string;
    labelSize: number;
    setLabelSize: (value: number) => void;
    changeFocusLevel: (direction: 1 | -1) => void;
    setCamera: SetCameraFunction;
    getDefaultCameraFocus: (levelMapId?: string | null) => VirtualGamingTabletopCameraState;
    fullScreen: boolean;
    setFullScreen: (value: boolean) => void;
    diceBagOpen: boolean;
    setDiceBagOpen: (set: boolean) => void;
    pinDiceBag: boolean;
    setPinDiceBag: (set: boolean) => void;
    setShowPiecesRoster: (update: (set: boolean) => boolean) => void;
    measureDistanceMode: boolean;
    elasticBandMode: boolean;
    toggleDragMode: (mode?: DragModeType) => void;
}

const MenuEveryone: FunctionComponent<MenuEveryoneProps> = (props) => {
    const {
        scenario, focusMapId, labelSize, setLabelSize, changeFocusLevel, setCamera, getDefaultCameraFocus,
        fullScreen, setFullScreen, diceBagOpen, setDiceBagOpen, pinDiceBag, setPinDiceBag, setShowPiecesRoster,
        measureDistanceMode, elasticBandMode, toggleDragMode
    } = props;
    return (
        <div>
            <div className='controlsRow'>
                <InputButton type='button' disabled={isMapIdHighest(scenario.maps, focusMapId)}
                             tooltip='Focus the camera on a map at a higher elevation.'
                             onChange={() => {
                                 changeFocusLevel(1);
                             }}>
                    <span className='material-icons'>expand_less</span>
                </InputButton>
                <InputButton type='button' tooltip='Re-focus the camera on the current map.'
                             onChange={() => {
                                 setCamera(getDefaultCameraFocus(), 1000);
                             }}>
                    <span className='material-icons'>videocam</span>
                </InputButton>
                <InputButton type='button' disabled={isMapIdLowest(scenario.maps, focusMapId)}
                             tooltip='Focus the camera on a map at a lower elevation.'
                             onChange={() => {
                                 changeFocusLevel(-1);
                             }}>
                    <span className='material-icons'>expand_more</span>
                </InputButton>
            </div>
            <div className='controlsRow'>
                <span className='smaller'>A</span>
                <InputField className='labelSizeInput' type='range' tooltip='Label Size'
                            initialValue={labelSize} minValue={0.05} maxValue={0.6} step={0.05}
                            onChange={(value) => {
                                setLabelSize(Number(value));
                            }}
                />
                <span className='larger'>A</span>
            </div>
            <div className='controlsRow'>
                <InputButton type='button'
                             tooltip={fullScreen ? 'Exit full-screen mode.' : 'Start full-screen mode.'}
                             onChange={() => {setFullScreen(!fullScreen)}}>
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
                             tooltip={diceBagOpen ? 'Toggle whether the dice bag automatically closes or not.' : 'Open dice bag.'}
                             onChange={() => {
                                 if (diceBagOpen) {
                                     setPinDiceBag(!pinDiceBag);
                                 } else {
                                     setDiceBagOpen(true);
                                 }
                             }}>
                    <span className='material-icons'>casino</span>
                    {
                        !pinDiceBag ? null : (
                            <span className='material-icons overlayIcon'>lock</span>
                        )
                    }
                </InputButton>
            </div>
            <div className='controlsRow'>
                <InputButton type='button'
                             tooltip='Open roster of pieces on the tabletop.'
                             onChange={() => {setShowPiecesRoster((show) => (!show))}}>
                    <span className='material-icons'>people</span>
                </InputButton>
                <InputButton type='checkbox'
                             tooltip='Measure distances on the tabletop.'
                             selected={measureDistanceMode}
                             toggle={true}
                             onChange={() => {toggleDragMode('measureDistanceMode')}}>
                    <span className='material-icons'>straighten</span>
                </InputButton>
                <InputButton type='checkbox'
                             tooltip='Select and move multiple pieces at once.'
                             selected={elasticBandMode}
                             toggle={true}
                             onChange={() => {toggleDragMode('elasticBandMode')}}>
                    <span className='material-icons'>select_all</span>
                </InputButton>
            </div>

        </div>
    )
};

export default MenuEveryone;