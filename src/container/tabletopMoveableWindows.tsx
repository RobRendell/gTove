import without from 'lodash/without';
import {FunctionComponent, useCallback, useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {useCameraParameters} from '../context/cameraParametersContextBridge';
import DiceBag from '../presentation/dice/diceBag';
import MovableWindow from '../presentation/movableWindow';
import PaintTools from '../presentation/paintTools';
import PiecesRoster from '../presentation/piecesRoster';
import {
    getDiceFromStore,
    getLoggedInUserFromStore,
    getScenarioFromStore,
    getTabletopFromStore,
    getTabletopStateFromStore
} from '../redux/mainReducer';
import {updateTabletopAction} from '../redux/tabletopReducer';
import {setTabletopStatePaintOpenAction} from '../redux/tabletopStateReducer';
import {getFocusMapIdAndFocusPointAtLevel, getUserDiceColours, ObjectVector3} from '../util/scenarioUtils';
import {buildVector3} from '../util/threeUtils';

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
    paintControls = 'paintControls'
}

const TabletopMoveableWindows: FunctionComponent<TabletopMoveableWindowsProps> = (
    {
        diceBagOpen, setDiceBagOpen, showPiecesRoster, setShowPiecesRoster,
        userIsGM, readOnly
    }
) => {
    const dispatch = useDispatch();
    const {cameraPositionRef, cameraLookAtRef, setCameraParameters} = useCameraParameters();

    const [windowOrder, setWindowOrder] = useState<MoveableWindowEnum[]>([MoveableWindowEnum.diceBag, MoveableWindowEnum.piecesRoster, MoveableWindowEnum.paintControls]);

    const raiseWindow = useCallback((window: MoveableWindowEnum) => {
        setWindowOrder((order) => ([...without(order, window), window]));
    }, []);

    const raiseDiceBag = useCallback(() => {
        raiseWindow(MoveableWindowEnum.diceBag);
    }, [raiseWindow]);

    const closeDiceBag = useCallback(() => {
        setDiceBagOpen(false);
    }, [setDiceBagOpen]);

    const raisePiecesRoster = useCallback(() => {
        raiseWindow(MoveableWindowEnum.piecesRoster);
    }, [raiseWindow]);

    const closePiecesRoster = useCallback(() => {
        setShowPiecesRoster(false);
    }, [setShowPiecesRoster]);

    const raisePaintControls = useCallback(() => {
        raiseWindow(MoveableWindowEnum.paintControls);
    }, [raiseWindow]);

    const closePaintControls = useCallback(() => {
        dispatch(setTabletopStatePaintOpenAction(false));
    }, [dispatch])

    const dice = useSelector(getDiceFromStore);
    const tabletop = useSelector(getTabletopFromStore);
    const loggedInUser = useSelector(getLoggedInUserFromStore)!;
    const scenario = useSelector(getScenarioFromStore);

    useEffect(() => {
        if (diceBagOpen) {
            raiseDiceBag();
        }
    }, [diceBagOpen, raiseDiceBag]);

    useEffect(() => {
        if (showPiecesRoster) {
            raisePiecesRoster();
        }
    }, [showPiecesRoster, raisePiecesRoster]);

    const {paintState, playerView} = useSelector(getTabletopStateFromStore);
    useEffect(() => {
        if (paintState.open) {
            raisePaintControls();
        }
    }, [paintState.open, raisePaintControls]);

    return (
        <>
            {
                windowOrder.map((window) => {
                    switch (window) {
                        case MoveableWindowEnum.diceBag:
                            return (!diceBagOpen) ? null : (
                                <MovableWindow key='diceBagWindow' title='Dice Bag' onClose={closeDiceBag}
                                               onInteract={raiseDiceBag}
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
                                               onClose={closePiecesRoster} onInteract={raisePiecesRoster}
                                >
                                    <PiecesRoster minis={scenario.minis}
                                                  piecesRosterColumns={tabletop.piecesRosterColumns}
                                                  playerView={!userIsGM || playerView}
                                                  readOnly={readOnly}
                                                  focusCamera={(position: ObjectVector3) => {
                                                      const newCameraLookAt = buildVector3(position);
                                                      const {focusMapId} = getFocusMapIdAndFocusPointAtLevel(scenario.maps, position.y);
                                                      // Simply shift the cameraPosition by the same delta as we're shifting the cameraLookAt.
                                                      const newCameraPosition = newCameraLookAt.clone().sub(cameraLookAtRef.current).add(cameraPositionRef.current);
                                                      setCameraParameters({cameraLookAt: newCameraLookAt, cameraPosition: newCameraPosition}, 1000, focusMapId);
                                                  }}
                                    />
                                </MovableWindow>
                            );
                        case MoveableWindowEnum.paintControls:
                            return !paintState.open ? null : (
                                <MovableWindow key='paintWindow' title='Paint' onClose={closePaintControls}
                                               onInteract={raisePaintControls}
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
                        default:
                            return null;
                    }
                })
            }
        </>
    )
};

export default TabletopMoveableWindows;