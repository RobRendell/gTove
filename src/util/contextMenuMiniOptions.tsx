import {toast} from 'react-toastify';
import {Quaternion, Vector3} from 'three';
import {v4} from 'uuid';

import ColourPicker from '../presentation/colourPicker';
import InputField from '../presentation/inputField';
import Tooltip from '../presentation/tooltip';
import VisibilitySlider from '../presentation/visibilitySlider';
import {
    addMiniAction,
    addMiniWaypointAction,
    cancelMiniMoveAction,
    cancelMiniWaypointAction,
    confirmMiniMoveAction,
    removeMiniAction,
    removeMiniWaypointAction,
    undoGroupAction,
    updateAttachMinisAction,
    updateMiniBaseColourAction,
    updateMiniFlatAction,
    updateMiniHideBaseAction,
    updateMiniLockedAction,
    updateMiniNameAction,
    updateMiniProneAction,
    updateMiniVisibilityAction
} from '../redux/scenarioReducer';
import {updateTabletopAction, updateTabletopVideoMutedAction} from '../redux/tabletopReducer';
import {setTabletopStateSelectedNoteMiniIdAction} from '../redux/tabletopStateReducer';
import {MAP_DELTA, MINI_HEIGHT} from './constants';
import {ContextMenuOption, MiniMenuContext} from './contextMenuTypes';
import {promiseSleep} from './promiseSleep';
import {MiniType, MovementPathPoint, ScenarioType, snapMiniIdToTabletop, TabletopType} from './scenarioUtils';
import {PieceVisibilityEnum, TemplateProperties, TemplateShape} from './storage/storageContract';
import {castTemplateProperties, isMiniMetadata, isTemplateMetadata} from './storage/storageUtils';
import {buildEuler} from './threeUtils';

export const contextMenuMiniOptions: ContextMenuOption<MiniMenuContext>[] = [
    {
        render: ({selected, mini, verifyMiniVisibility, dispatch}) => {
            return (
                <Tooltip tooltip='Visibility to players: Fog means hidden by Fog of War on a map.' verticalSpace={40}>
                    <label>
                        <VisibilitySlider visibility={mini.visibility} onChange={async (value) => {
                            if (await verifyMiniVisibility(selected.miniId, value)) {
                                dispatch(updateMiniVisibilityAction(selected.miniId, value));
                            }
                        }}/>
                    </label>
                </Tooltip>
            );
        },
        show: ({userIsGM, mini}) => (userIsGM || userOwnsMini(mini))
    },
    {
        label: 'Add GM note',
        title: 'Add a rich text GM note to this piece',
        onClick: ({selected, dispatch}) => {
            dispatch(setTabletopStateSelectedNoteMiniIdAction(selected.miniId));
        },
        show: ({userIsGM, mini}) => (userIsGM && !mini.gmNoteMarkdown)
    },
    {
        label: 'Open GM note',
        title: 'Show the GM note associated with this piece (closing any other GM notes)',
        onClick: ({selected, dispatch}) => {
            dispatch(setTabletopStateSelectedNoteMiniIdAction(selected.miniId));
        },
        show: ({selected, userIsGM, mini, tabletopState}) => (
            userIsGM && !!mini.gmNoteMarkdown && tabletopState.selectedNoteMiniId !== selected.miniId
        )
    },
    {
        label: 'Close GM note',
        title: 'Close the GM note associated with this piece',
        onClick: ({dispatch}) => {
            dispatch(setTabletopStateSelectedNoteMiniIdAction(null));
        },
        show: ({selected, userIsGM, tabletopState}) => (
            userIsGM && tabletopState.selectedNoteMiniId === selected.miniId
        )
    },
    {
        label: 'Confirm move',
        title: 'Reset the piece\'s starting position to its current location',
        onClick: ({selected, dispatch, scenario}) => {
            dispatch(confirmMiniMoveAction(getMovedMiniId(selected.miniId, scenario.minis)!));
        },
        show: ({selected, scenario}) => (!!getMovedMiniId(selected.miniId, scenario.minis))
    },
    {
        label: 'Make waypoint',
        title: 'Make the current position a waypoint on the path',
        onClick: ({selected, dispatch, scenario}) => {
            dispatch(addMiniWaypointAction(getMovedMiniId(selected.miniId, scenario.minis)!));
        },
        show: ({selected, scenario}) => (!!getMovedMiniId(selected.miniId, scenario.minis))
    },
    {
        label: 'Remove waypoint',
        title: 'Remove the last waypoint added to the path',
        onClick: ({selected, dispatch, scenario}) => {
            dispatch(removeMiniWaypointAction(getMovedMiniId(selected.miniId, scenario.minis)!));
        },
        show: ({mini}) => (!!mini.movementPath && mini.movementPath.length > 1)
    },
    {
        label: 'Cancel move',
        title: 'Reset the piece\'s position back to where it started',
        onClick: ({selected, dispatch, scenario}) => {
            dispatch(cancelMiniMoveAction(getMovedMiniId(selected.miniId, scenario.minis)!));
        },
        show: ({selected, scenario}) => (!!getMovedMiniId(selected.miniId, scenario.minis))
    },
    {
        label: 'Cancel waypoint',
        title: 'Reset the piece\'s position back to the last waypoint, and remove the waypoint',
        onClick: ({selected, dispatch, scenario}) => {
            dispatch(cancelMiniWaypointAction(getMovedMiniId(selected.miniId, scenario.minis)!));
        },
        show: ({mini}) => (!!mini.movementPath && mini.movementPath.length > 1)
    },
    {
        label: 'Attach...',
        title: 'Attach this piece to another.',
        onClick: ({selected, setMenuSelected, scenario, tabletop}) => {
            const attachIds = getOverlappingDetachedMinis(selected.miniId, scenario, tabletop);
            setMenuSelected({selected: {...selected, attachIds}, label: 'Attach to which piece?'});
        },
        show: ({selected, mini, scenario, tabletop}) => (
            !mini.attachMiniId && getOverlappingDetachedMinis(selected.miniId, scenario, tabletop).length > 0
        ),
        keepOpenOnClick: true,
        autoExecuteSingleOption: true
    },
    {
        label: 'Detach',
        title: 'Detach this piece from the piece it is attached to.',
        onClick: ({selected, scenario, tabletop, dispatch}) => {
            const snapMini = snapMiniIdToTabletop(selected.miniId, scenario, tabletop);
            if (!snapMini) {
                // Mini may have been deleted mid-action
                return;
            }
            const {positionObj, rotationObj, elevation} = snapMini;
            dispatch(updateAttachMinisAction(selected.miniId, undefined, positionObj, rotationObj, elevation));
        },
        show: ({mini}) => (mini.attachMiniId !== undefined)
    },
    {
        label: 'Move attachment point',
        title: 'Move this piece relative to the piece it is attached to.',
        onClick: ({selected, setSelected}) => {
            setSelected({...selected, miniId: selected.miniId});
        },
        show: ({mini}) => (mini.attachMiniId !== undefined)
    },
    {
        label: 'Lie down',
        title: 'Tip this piece over so it\'s lying down.',
        onClick: ({selected, dispatch}) => {dispatch(updateMiniProneAction(selected.miniId, true))},
        show: ({mini}) => (isMiniMetadata(mini.metadata) && !mini.prone)
    },
    {
        label: 'Stand up',
        title: 'Stand this piece up.',
        onClick: ({selected, dispatch}) => {dispatch(updateMiniProneAction(selected.miniId, false))},
        show: ({mini}) => (isMiniMetadata(mini.metadata) && mini.prone)
    },
    {
        label: 'Make flat',
        title: 'Make this piece always render as a flat counter.',
        onClick: ({selected, dispatch}) => {dispatch(updateMiniFlatAction(selected.miniId, true))},
        show: ({mini}) => (isMiniMetadata(mini.metadata) && !mini.flat)
    },
    {
        label: 'Make standee',
        title: 'Make this piece render as a standee when not viewed from above.',
        onClick: ({selected, dispatch}) => {dispatch(updateMiniFlatAction(selected.miniId, false))},
        show: ({mini}) => (isMiniMetadata(mini.metadata) && mini.flat)
    },
    {
        label: 'Mute Video',
        title: 'Mute the audio track of this video texture',
        onClick: ({mini, dispatch}) => {
            dispatch(updateTabletopVideoMutedAction(mini.metadata.id, true));
        },
        show: ({userIsGM, mini, tabletop}) => (
            userIsGM && tabletop.videoMuted[mini.metadata.id] === false
        )
    },
    {
        label: 'Unmute Video',
        title: 'Unmute the audio track of this video texture',
        onClick: ({mini, dispatch}) => {
            dispatch(updateTabletopVideoMutedAction(mini.metadata.id, false));
        },
        show: ({userIsGM, mini, tabletop}) => (
            userIsGM && tabletop.videoMuted[mini.metadata.id] === true
        )
    },
    {
        label: 'Lock position',
        title: 'Prevent movement of this piece until unlocked again.',
        onClick: ({selected, dispatch}) => {dispatch(updateMiniLockedAction(selected.miniId, true))},
        show: ({userIsGM, mini}) => ((userIsGM || userOwnsMini(mini)) && !mini.attachMiniId && !mini.locked)
    },
    {
        label: 'Unlock position',
        title: 'Allow movement of this piece again.',
        onClick: ({selected, dispatch}) => {dispatch(updateMiniLockedAction(selected.miniId, false))},
        show: ({userIsGM, mini}) => ((userIsGM || userOwnsMini(mini)) && !mini.attachMiniId && mini.locked)
    },
    {
        label: 'Make ungrabbable',
        title: 'Prevent this attached piece from registering gestures and mouse movement.',
        onClick: ({selected, dispatch}) => {dispatch(updateMiniLockedAction(selected.miniId, true))},
        show: ({userIsGM, mini}) => ((userIsGM || userOwnsMini(mini)) && !!mini.attachMiniId && !mini.locked)
    },
    {
        label: 'Make grabbable',
        title: 'Allow this attached piece to register gestures and mouse movement again.',
        onClick: ({selected, dispatch}) => {dispatch(updateMiniLockedAction(selected.miniId, false))},
        show: ({userIsGM, mini}) => ((userIsGM || userOwnsMini(mini)) && !!mini.attachMiniId && mini.locked)
    },
    {
        label: 'Hide base',
        title: 'Hide the base of the standee piece.',
        onClick: ({selected, dispatch}) => {dispatch(updateMiniHideBaseAction(selected.miniId, true))},
        show: ({userIsGM, mini}) => ((userIsGM || userOwnsMini(mini)) && isMiniMetadata(mini.metadata) && !mini.hideBase)
    },
    {
        label: 'Show base',
        title: 'Show the base of the standee piece.',
        onClick: ({selected, dispatch}) => {dispatch(updateMiniHideBaseAction(selected.miniId, false))},
        show: ({userIsGM, mini}) => ((userIsGM || userOwnsMini(mini)) && isMiniMetadata(mini.metadata) && mini.hideBase)
    },
    {
        label: 'Color base',
        title: 'Change the standee piece\'s base color.',
        onClick: async ({promiseModal, setMenuSelected, mini, tabletop, selected, dispatch}) => {
            if (promiseModal?.isAvailable()) {
                setMenuSelected();
                const okOption = 'OK';
                let baseColour = mini.baseColour || 0;
                let swatches: string[] | undefined = undefined;
                const result = await promiseModal({
                    children: (
                        <div>
                            <p>Set base color for {mini.name}.</p>
                            <ColourPicker
                                disableAlpha={true}
                                initialColour={baseColour}
                                onColourChange={(colourObj) => {
                                    baseColour = (colourObj.rgb.r << 16) + (colourObj.rgb.g << 8) + colourObj.rgb.b;
                                }}
                                initialSwatches={tabletop.baseColourSwatches}
                                onSwatchChange={(newSwatches: string[]) => {
                                    swatches = newSwatches;
                                }}
                            />
                        </div>
                    ),
                    options: [okOption, 'Cancel']
                });
                if (result === okOption) {
                    dispatch(updateMiniBaseColourAction(selected.miniId, baseColour));
                    if (swatches) {
                        dispatch(updateTabletopAction({baseColourSwatches: swatches}));
                    }
                }
            }
        },
        show: ({userIsGM, mini}) => ((userIsGM || userOwnsMini(mini)) && isMiniMetadata(mini.metadata) && !mini.hideBase)
    },
    {
        label: 'Rename',
        title: 'Change the label shown for this piece.',
        onClick: ({selected, setMenuSelected, setEditSelected, mini, dispatch}) => {
            setMenuSelected();
            setEditSelected({
                selected,
                value: mini.name,
                finish: (value: string) => {
                    dispatch(updateMiniNameAction(selected.miniId, value));
                }
            });
        },
        show: ({userIsGM, mini}) => (userIsGM || userOwnsMini(mini))
    },
    {
        label: 'Scale',
        title: 'Adjust this piece\'s scale',
        onClick: ({setSelected, selected, finaliseSelectedBy}) => {
            setSelected({miniId: selected.miniId, point: selected.point, scale: true,
                finish: () => {finaliseSelectedBy()}});
            toast('Zoom in or out to change mini scale.');
        },
        show: ({userIsGM, mini}) => (userIsGM || userOwnsMini(mini))
    },
    {
        label: 'Duplicate...',
        title: 'Add duplicates of this piece to the tabletop.',
        onClick: async ({selected, promiseModal, setMenuSelected, mini, scenario, dispatch, findUnusedMiniName, findPositionForNewMini}) => {
            if (promiseModal?.isAvailable()) {
                setMenuSelected();
                const okOption = 'OK';
                let duplicateNumber: number = 1;
                const result = await promiseModal({
                    children: (
                        <div className='duplicateMiniDialog'>
                            Duplicate this miniature
                            <InputField type='number' select={true} initialValue={duplicateNumber} onChange={(value: number) => {
                                duplicateNumber = value;
                            }}/> time(s).
                        </div>
                    ),
                    options: [okOption, 'Cancel']
                });
                if (result === okOption) {
                    const match = mini.name.match(/^(.*?)( *[0-9]*)$/);
                    if (match) {
                        const baseName = match[1];
                        let name: string, suffix: number;
                        let space = true;
                        if (match[2]) {
                            suffix = Number(match[2]) + 1;
                            space = (match[2][0] === ' ');
                        } else {
                            // Update base mini name too, since it didn't have a numeric suffix.
                            [name, suffix] = findUnusedMiniName(baseName);
                            dispatch(updateMiniNameAction(selected.miniId, name));
                        }
                        const confirmMoves = scenario.confirmMoves;
                        const undoGroupId = v4();
                        for (let count = 0; count < duplicateNumber; ++count) {
                            [name, suffix] = findUnusedMiniName(baseName, suffix, space);
                            let position: MovementPathPoint = findPositionForNewMini(mini.visibility === PieceVisibilityEnum.HIDDEN, mini.scale, mini.position);
                            if (mini.elevation) {
                                position = {...position, elevation: mini.elevation};
                            }
                            dispatch(undoGroupAction(addMiniAction({
                                ...mini,
                                name,
                                position,
                                movementPath: confirmMoves ? [position] : undefined
                            }), undoGroupId));
                            // TODO I believe this will be unnecessary when all parent components are functional.
                            await promiseSleep(0);
                        }
                    }
                }
            }
        },
        show: ({userIsGM}) => (userIsGM)
    },
    {
        label: 'Remove',
        title: 'Remove this piece from the tabletop',
        onClick: ({selected, dispatch}) => {dispatch(removeMiniAction(selected.miniId))},
        show: ({userIsGM, mini}) => (userIsGM || userOwnsMini(mini))
    }
];

/**
 * If this mini or any mini it is attached to has moved, return the miniId of the moved mini closest to this one.
 */
function getMovedMiniId(miniId: string, minis: {[miniId: string]: MiniType}): string | undefined | null {
    const mini = minis[miniId];
    return (!mini?.movementPath ? undefined :
            (mini.movementPath.length > 1) ? miniId :
                (mini.movementPath[0].x !== mini.position.x
                    || mini.movementPath[0].y !== mini.position.y
                    || mini.movementPath[0].z !== mini.position.z
                    || (mini.movementPath[0].elevation || 0) !== mini.elevation)
                    ? miniId : undefined)
        || (mini.attachMiniId && getMovedMiniId(mini.attachMiniId, minis));
}

function isMiniAttachedTo(miniId: string, targetMiniId: string, scenario: ScenarioType): boolean {
    if (miniId === targetMiniId) {
        return true;
    } else {
        const mini = scenario.minis[miniId];
        return (mini.attachMiniId) ? isMiniAttachedTo(mini.attachMiniId, targetMiniId, scenario) : false;
    }
}

function doesMiniOverlapTemplate(miniId: string, templateId: string, scenario: ScenarioType, tabletop: TabletopType): boolean {
    const snappedMini = snapMiniIdToTabletop(miniId, scenario, tabletop);
    const snappedTemplate = snapMiniIdToTabletop(templateId, scenario, tabletop);
    if (!snappedMini || !snappedTemplate) {
        return false;
    }
    const {positionObj: miniPosition, scaleFactor: miniScale, elevation} = snappedMini;
    const {positionObj: templatePosition, elevation: templateElevation, rotationObj: templateRotation, scaleFactor: templateScale} = snappedTemplate;
    const template: MiniType = scenario.minis[templateId] as MiniType;
    const templateProperties: TemplateProperties =
        castTemplateProperties(template.metadata.properties as TemplateProperties);
    const dy = templatePosition.y - miniPosition.y + templateElevation;
    const miniRadius = miniScale / 2;
    const templateWidth = templateProperties.width * templateScale;
    const templateHeight = templateProperties.height * templateScale;
    if (dy < -templateHeight / 2 - 0.5 || dy > templateHeight / 2 + MINI_HEIGHT * miniScale + elevation + 0.5) {
        return false;
    }
    const adjustedPos = new Vector3(templatePosition.x - miniPosition.x, 0, templatePosition.z - miniPosition.z)
        .applyQuaternion(new Quaternion().setFromEuler(buildEuler(templateRotation)).invert())
        .add({x: templateProperties.offsetX, y: templateProperties.offsetY, z: templateProperties.offsetZ} as Vector3);
    switch (templateProperties.templateShape) {
        case TemplateShape.RECTANGLE:
            return (Math.abs(adjustedPos.x) < miniRadius + templateWidth / 2) && (Math.abs(adjustedPos.z) < miniRadius + (templateProperties.depth * templateScale) / 2);
        case TemplateShape.CIRCLE:
        case TemplateShape.ICON:
            return adjustedPos.x*adjustedPos.x + adjustedPos.z*adjustedPos.z < (miniRadius + templateWidth) * (miniRadius + templateWidth);
        case TemplateShape.ARC:
            if (adjustedPos.x*adjustedPos.x + adjustedPos.z*adjustedPos.z >= (miniRadius + templateWidth) * (miniRadius + templateWidth)) {
                return false;
            }
            const angle = Math.PI * (templateProperties.angle!) / 360;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const pointGreaterLine1 = -sin * adjustedPos.x + cos * adjustedPos.z + miniRadius > 0;
            const pointGreaterLine2 = sin * adjustedPos.x + cos * adjustedPos.z - miniRadius < 0;
            return ((templateProperties.angle!) < 180) ? pointGreaterLine1 && pointGreaterLine2 : pointGreaterLine1 || pointGreaterLine2;
    }
}

function doMinisOverlap(mini1Id: string, mini2Id: string, scenario: ScenarioType, tabletop: TabletopType): boolean {
    const mini1 = scenario.minis[mini1Id];
    const mini2 = scenario.minis[mini2Id];
    const mini1Template = isTemplateMetadata(mini1.metadata);
    const mini2Template = isTemplateMetadata(mini2.metadata);
    if (!mini1Template && !mini2Template) {
        const snapMini1 = snapMiniIdToTabletop(mini1Id, scenario, tabletop);
        const snapMini2 = snapMiniIdToTabletop(mini2Id, scenario, tabletop);
        if (!snapMini1 || !snapMini2) {
            return false;
        }
        const {positionObj: position1, scaleFactor: scale1} = snapMini1;
        const {positionObj: position2, scaleFactor: scale2} = snapMini2;
        const dx = position2.x - position1.x,
            dy = position2.y - position1.y,
            dz = position2.z - position1.z,
            r1 = scale1 / 2, r2 = scale2 / 2;
        return Math.abs(dy) < MAP_DELTA && (dx*dx + dz*dz < (r1 + r2) * (r1 + r2));
    } else if (mini1Template && mini2Template) {
        return false; // TODO
    } else if (mini1Template) {
        return doesMiniOverlapTemplate(mini2Id, mini1Id, scenario, tabletop);
    } else {
        return doesMiniOverlapTemplate(mini1Id, mini2Id, scenario, tabletop);
    }
}

function getOverlappingDetachedMinis(miniId: string, scenario: ScenarioType, tabletop: TabletopType): string[] {
    return Object.keys(scenario.minis).filter((otherMiniId) => {
        // Ensure we don't create attachment loops.
        if (isMiniAttachedTo(otherMiniId, miniId, scenario)) {
            return false;
        } else {
            return doMinisOverlap(miniId, otherMiniId, scenario, tabletop);
        }
    });
}

function userOwnsMini(mini: MiniType): boolean {
    return (mini?.metadata.owners?.reduce((acc, owner) => (acc || !!owner.me), false))
        ?? false;
}

