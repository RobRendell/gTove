import without from 'lodash/without';
import {FunctionComponent, useCallback, useEffect, useMemo, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import DeviceLayoutComponent from '../presentation/deviceLayoutComponent';
import DiceBag from '../presentation/dice/diceBag';
import MovableWindow from '../presentation/movableWindow';
import PaintTools from '../presentation/paintTools';
import PiecesRoster from '../presentation/piecesRoster';
import {
    getDiceFromStore,
    getLoggedInUserFromStore,
    getTabletopFromStore,
    getTabletopStateFromStore
} from '../redux/mainReducer';
import {updateTabletopAction} from '../redux/tabletopReducer';
import {setTabletopStateDeviceLayoutOpenAction, setTabletopStatePaintOpenAction} from '../redux/tabletopStateReducer';
import {getUserDiceColours} from '../util/scenarioUtils';

interface TabletopMoveableWindowsProps {
    diceBagOpen: boolean;
    setDiceBagOpen: (open: boolean) => void;
    showPiecesRoster: boolean;
    setShowPiecesRoster: (show: boolean) => void;
    userIsGM: boolean;
    readOnly: boolean;
}

enum MoveableWindowEnum {
    diceBag = 'diceBag',
    piecesRoster = 'piecesRoster',
    paintControls = 'paintControls',
    deviceLayout = 'deviceLayout'
}

const allWindowsMap: {[key in MoveableWindowEnum]: true} = {
    [MoveableWindowEnum.diceBag]: true,
    [MoveableWindowEnum.piecesRoster]: true,
    [MoveableWindowEnum.paintControls]: true,
    [MoveableWindowEnum.deviceLayout]: true
};

const allWindows = Object.keys(allWindowsMap) as MoveableWindowEnum[];

const TabletopMoveableWindows: FunctionComponent<TabletopMoveableWindowsProps> = (
    {
        diceBagOpen, setDiceBagOpen, showPiecesRoster, setShowPiecesRoster,
        userIsGM, readOnly
    }
) => {
    const dispatch = useDispatch();
    const {paintState, playerView, deviceLayoutOpen} = useSelector(getTabletopStateFromStore);
    const dice = useSelector(getDiceFromStore);
    const tabletop = useSelector(getTabletopFromStore);
    const loggedInUser = useSelector(getLoggedInUserFromStore)!;

    const [windowOrder, setWindowOrder] = useState<MoveableWindowEnum[]>(allWindows);

    const raiseWindow = useCallback((window: MoveableWindowEnum) => {
        setWindowOrder((order) => ([...without(order, window), window]));
    }, []);

    const raiseWindowMap = useMemo(() => (
        Object.fromEntries(
            allWindows.map((windowId) => ([windowId, () => (raiseWindow(windowId))]))
        )
    ), [raiseWindow]);

    const closeDiceBag = useCallback(() => {
        setDiceBagOpen(false);
    }, [setDiceBagOpen]);

    const closePiecesRoster = useCallback(() => {
        setShowPiecesRoster(false);
    }, [setShowPiecesRoster]);

    const closePaintControls = useCallback(() => {
        dispatch(setTabletopStatePaintOpenAction(false));
    }, [dispatch])

    const closeDeviceLayout = useCallback(() => {
        dispatch(setTabletopStateDeviceLayoutOpenAction(false));
    }, [dispatch])
    
    useEffect(() => {
        if (diceBagOpen) {
            raiseWindowMap[MoveableWindowEnum.diceBag]();
        }
    }, [diceBagOpen, raiseWindowMap]);

    useEffect(() => {
        if (showPiecesRoster) {
            raiseWindowMap[MoveableWindowEnum.piecesRoster]();
        }
    }, [showPiecesRoster, raiseWindowMap]);

    useEffect(() => {
        if (paintState.open) {
            raiseWindowMap[MoveableWindowEnum.paintControls]();
        }
    }, [paintState.open, raiseWindowMap]);

    useEffect(() => {
        if (deviceLayoutOpen) {
            raiseWindowMap[MoveableWindowEnum.deviceLayout]();
        }
    }, [deviceLayoutOpen, raiseWindowMap]);

    return (
        <>
            {
                windowOrder.map((window) => {
                    switch (window) {
                        case MoveableWindowEnum.diceBag:
                            return (!diceBagOpen) ? null : (
                                <MovableWindow key='diceBagWindow' title='Dice Bag' onClose={closeDiceBag}
                                               onInteract={raiseWindowMap[MoveableWindowEnum.diceBag]}
                                >
                                    <DiceBag dice={dice}
                                             userDiceColours={getUserDiceColours(tabletop, loggedInUser.emailAddress)}
                                             onClose={closeDiceBag}
                                    />
                                </MovableWindow>
                            );
                        case MoveableWindowEnum.piecesRoster:
                            return (!showPiecesRoster) ? null : (
                                <MovableWindow key='piecesRosterWindow' title='Tabletop Pieces Roster'
                                               onClose={closePiecesRoster}
                                               onInteract={raiseWindowMap[MoveableWindowEnum.piecesRoster]}
                                >
                                    <PiecesRoster piecesRosterColumns={tabletop.piecesRosterColumns}
                                                  playerView={!userIsGM || playerView}
                                                  readOnly={readOnly}
                                    />
                                </MovableWindow>
                            );
                        case MoveableWindowEnum.paintControls:
                            return !paintState.open ? null : (
                                <MovableWindow key='paintWindow' title='Paint' onClose={closePaintControls}
                                               onInteract={raiseWindowMap[MoveableWindowEnum.paintControls]}
                                >
                                    <PaintTools
                                        paintState={paintState}
                                        paintToolColourSwatches={tabletop.paintToolColourSwatches}
                                        updatePaintToolColourSwatches={(paintToolColourSwatches) => {
                                            dispatch(updateTabletopAction({paintToolColourSwatches}));
                                        }}
                                    />
                                </MovableWindow>
                            );
                        case MoveableWindowEnum.deviceLayout:
                            return !deviceLayoutOpen ? null : (
                                <MovableWindow key='deviceLayoutWindow' title='Device Layout'
                                               onClose={closeDeviceLayout}
                                               onInteract={raiseWindowMap[MoveableWindowEnum.deviceLayout]}
                                >
                                    <DeviceLayoutComponent onFinish={closeDeviceLayout} />
                                </MovableWindow>
                            )
                        default:
                            return null;
                    }
                })
            }
        </>
    )
};

export default TabletopMoveableWindows;