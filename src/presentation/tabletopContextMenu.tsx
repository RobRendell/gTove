import './tabletopContextMenu.scss';

import {FunctionComponent, useCallback, useContext, useMemo} from 'react';
import {shallowEqual, useDispatch, useSelector} from 'react-redux';
import {toast} from 'react-toastify';
import * as THREE from 'three';
import {Euler, Vector3} from 'three';

import StayInsideContainer from '../container/stayInsideContainer';
import {useCameraParameters} from '../context/cameraParametersContextBridge';
import {PromiseModalContextObject} from '../context/promiseModalContextBridge';
import {
    getMyPeerIdFromStore,
    getScenarioFromStore,
    getTabletopFromStore,
    getTabletopStateFromStore
} from '../redux/mainReducer';
import {ReduxStoreType} from '../redux/mainReducerTypes';
import {updateAttachMinisAction} from '../redux/scenarioReducer';
import {contextMenuFogOfWarHandleOptions} from '../util/contextMenuFogOfWarOptions';
import {contextMenuMapOptions} from '../util/contextMenuMapOptions';
import {contextMenuMiniOptions} from '../util/contextMenuMiniOptions';
import {contextMenuRepositionHandleOptions} from '../util/contextMenuRepositionHandleOptions';
import {
    AnyMenuContext,
    BaseMenuContext,
    ButtonContextMenuOption,
    ContextMenuOption,
    isMapMenuContext,
    isMiniMenuContext,
    MiniMenuContext
} from '../util/contextMenuTypes';
import {getPieceName, MovementPathPoint, ObjectVector3, snapMiniIdToTabletop} from '../util/scenarioUtils';
import {PieceVisibilityEnum} from '../util/storage/storageContract';
import {buildVector3} from '../util/threeUtils';
import InputButton from './inputButton';
import {TabletopViewComponentEditSelected, TabletopViewComponentMenuSelected} from './tabletopViewComponent';

function isTabletopViewComponentButtonMenuOption<Context extends BaseMenuContext>(option: any): option is ButtonContextMenuOption<Context> {
    return option.label !== undefined && option.title !== undefined && option.onClick;
}

function renderMenuOption<Context extends BaseMenuContext>(option: ContextMenuOption<Context>, context: Context, setMenuSelected: (menuSelected?: TabletopViewComponentMenuSelected) => void) {
    return (option.show && !option.show(context)) ? null
        : isTabletopViewComponentButtonMenuOption<Context>(option) ? (
            <InputButton type='button' tooltip={option.title} onChange={() => {
                option.onClick(context);
                if (!option.keepOpenOnClick) {
                    setMenuSelected();
                }
            }}>
                {option.label}
            </InputButton>
        ) : (
            option.render(context, setMenuSelected)
        )
}

interface TabletopContextMenuProps {
    menuSelected?: TabletopViewComponentMenuSelected;
    setMenuSelected: (menuSelected?: TabletopViewComponentMenuSelected) => void;
    setEditSelected: (editSelected?: TabletopViewComponentEditSelected) => void;
    confirmLargeFogOfWarAction: (mapIds: string[]) => Promise<boolean>;
    replaceMapImageFn?: (metadataId: string) => void;
    verifyMiniVisibility: (miniId: string, visibility: PieceVisibilityEnum) => Promise<boolean>;
    userIsGM: boolean;
    findPositionForNewMini: (allowHiddenMap: boolean, scale: number, basePosition?: THREE.Vector3 | ObjectVector3) => MovementPathPoint;
    findUnusedMiniName: (baseName: string, suffix?: number, space?: boolean) => [string, number];
}

const TabletopContextMenu: FunctionComponent<TabletopContextMenuProps> = ({
                                                                              menuSelected,
                                                                              setMenuSelected,
                                                                              setEditSelected,
                                                                              confirmLargeFogOfWarAction,
                                                                              replaceMapImageFn,
                                                                              verifyMiniVisibility,
                                                                              userIsGM,
                                                                              findPositionForNewMini,
                                                                              findUnusedMiniName
                                                                          }) => {
    const dispatch = useDispatch();
    const promiseModal = useContext(PromiseModalContextObject);
    const myPeerId = useSelector(getMyPeerIdFromStore);
    const {focusMapId} = useSelector(getTabletopStateFromStore);
    const {setCameraParameters, setFocusMapId} = useCameraParameters();

    const contextMenuClick = menuSelected?.selected;
    const selectContextFromStore = useCallback((state: ReduxStoreType): AnyMenuContext | undefined => {
        const scenario = getScenarioFromStore(state);
        const tabletop = getTabletopFromStore(state);
        const tabletopState = getTabletopStateFromStore(state);
        return !contextMenuClick ? undefined : {
            selected: contextMenuClick,
            myPeerId,
            setMenuSelected,
            setEditSelected,
            dispatch,
            setCameraParameters,
            map: !contextMenuClick?.mapId ? undefined : scenario.maps[contextMenuClick.mapId],
            mini: !contextMenuClick?.miniId ? undefined : scenario.minis[contextMenuClick.miniId],
            focusMapId,
            setFocusMapId,
            userIsGM,
            scenario,
            tabletop,
            tabletopState,
            confirmLargeFogOfWarAction,
            replaceMapImageFn,
            promiseModal,
            verifyMiniVisibility,
            findPositionForNewMini,
            findUnusedMiniName
        };
    }, [contextMenuClick, myPeerId, setMenuSelected, setEditSelected, dispatch, setCameraParameters, focusMapId, setFocusMapId, userIsGM, confirmLargeFogOfWarAction, replaceMapImageFn, promiseModal, verifyMiniVisibility, findPositionForNewMini, findUnusedMiniName]);
    const context = useSelector(selectContextFromStore, shallowEqual);
    const optionElements = useMemo(() => {
        const options = menuSelected?.options ?? (
            context?.selected.selectIds ? mapSelectIds(context)
            : isMapMenuContext(context) ? contextMenuMapOptions
                : isMiniMenuContext(context) ? (context?.selected.attachIds ? mapAttachIds(context) : contextMenuMiniOptions)
                    : context?.selected.repositionMap ? contextMenuRepositionHandleOptions
                        : context?.selected.fogOfWarHandle ? contextMenuFogOfWarHandleOptions
                            : []
        );
        if (options.length === 1 && 'onClick' in options[0] && options[0].autoExecuteSingleOption) {
            options[0].onClick(context as any);
            setMenuSelected();
            return [];
        }
        return options.map((option) => (renderMenuOption(option as ContextMenuOption<AnyMenuContext>, context!, setMenuSelected)))
    }, [context, menuSelected?.options, setMenuSelected]);

    const clearMenuSelected = useCallback(() => {
        setMenuSelected();
    }, [setMenuSelected]);

    return (!contextMenuClick || !contextMenuClick.position || optionElements.filter(Boolean).length === 0) ? null : (
        <StayInsideContainer className='tabletopContextMenu'
                             top={contextMenuClick.position.y + 10}
                             left={contextMenuClick.position.x + 10}
        >
            {
                !menuSelected.label ? null : (
                    <div className='menuSelectedTitle'>{menuSelected.label}</div>
                )
            }
            <div className='menuCancel' onClick={clearMenuSelected} onTouchStart={clearMenuSelected}>&times;</div>
            <div className='scrollable'>
                {
                    optionElements
                        .map((Option, index) => (
                            !Option ? null : <div key={'menuButton' + index}>{Option}</div>
                        ))
                }
            </div>
        </StayInsideContainer>
    );
};

export default TabletopContextMenu;

function mapSelectIds<Context extends AnyMenuContext>(context: Context): ButtonContextMenuOption<Context>[] {
    const {selectIds, selectIdType: _selectIdType, ...selected} = context.selected;
    const {scenario, tabletop} = context;
    return selectIds!
        .map(({mapId, miniId}) => {
            const name = miniId ? getPieceName(miniId, scenario.minis, tabletop.piecesRosterColumns)
                : (mapId ? scenario.maps[mapId]?.name : undefined) ?? '';
            return {
                label: name,
                title: 'Select ' + name,
                onClick: () => {
                    context.setMenuSelected({
                        label: name,
                        selected: {...selected, mapId, miniId}
                    });
                },
                keepOpenOnClick: true
            }
        });
}

function mapAttachIds(context: MiniMenuContext): ButtonContextMenuOption<MiniMenuContext>[] {
    return context.selected.attachIds!
        .map((attachMiniId) => {
            const attachMini = context.scenario.minis[attachMiniId];
            const attachMiniName = getPieceName(attachMiniId, context.scenario.minis, context.tabletop.piecesRosterColumns);
            return attachMini.visibility < context.mini!.visibility ? {
                label: `(${attachMiniName} is less visible)`,
                title: 'You cannot attach a piece to something which is less visible.',
                onClick: () => {
                    toast('You cannot attach a piece to something which is less visible.');
                },
                keepOpenOnClick: true
            } : {
                label: `Attach to ${attachMiniName}`,
                title: `Attach this piece to ${attachMiniName}`,
                onClick: ({scenario, tabletop}) => {
                    const snapMini = snapMiniIdToTabletop(context.selected.miniId!, scenario, tabletop);
                    if (!snapMini) {
                        // Mini may have been deleted mid-action
                        toast(`Unable to determine the position of ${context.selected.name}?  Action failed.`);
                        return;
                    }
                    let {positionObj, rotationObj, elevation} = snapMini;
                    // Need to make position and rotation relative to the attachMiniId
                    const attachSnapMini = snapMiniIdToTabletop(attachMiniId, scenario, tabletop);
                    if (!attachSnapMini) {
                        toast(`Unable to determine the position of ${attachMiniName}?  Action failed.`);
                        // Mini may have been deleted mid-action
                        return;
                    }
                    const {positionObj: attachPosition, rotationObj: attachRotation, elevation: otherElevation} = attachSnapMini;
                    positionObj = buildVector3(positionObj).sub(attachPosition as Vector3).applyEuler(new Euler(-attachRotation.x, -attachRotation.y, -attachRotation.z, attachRotation.order));
                    rotationObj = {x: rotationObj.x - attachRotation.x, y: rotationObj.y - attachRotation.y, z: rotationObj.z - attachRotation.z, order: rotationObj.order};
                    context.dispatch(updateAttachMinisAction(context.selected.miniId, attachMiniId, positionObj, rotationObj, elevation - otherElevation));
                },
                autoExecuteSingleOption: true
            };
        })
}