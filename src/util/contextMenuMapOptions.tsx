import partition from 'lodash/partition';
import * as THREE from 'three';
import {v4} from 'uuid';

import {
    addMapAction,
    removeMapAction,
    removeMiniAction,
    undoGroupThunk,
    updateMapCameraFocusPoint,
    updateMapFogOfWarAction,
    updateMapGMOnlyAction,
    updateMapPositionAction,
    updateMapSelectedByAction,
    updateMapTransparencyAction,
    updateMiniElevationAction,
    updateMiniPositionAction
} from '../redux/scenarioReducer';
import {updateTabletopVideoMutedAction} from '../redux/tabletopReducer';
import {MAP_EPSILON, NEW_MAP_DELTA_Y} from './constants';
import {ContextMenuOption, MapMenuContext} from './contextMenuTypes';
import {promiseSleep} from './promiseSleep';
import {
    getBaseCameraParameters,
    getFocusMapIdAndFocusPointAtLevel,
    getMapIdOnNextLevel,
    getMapIdsAtLevel
} from './scenarioUtils';
import {GridType} from './storage/storageContract';
import {buildVector3} from './threeUtils';

export const contextMenuMapOptions: ContextMenuOption<MapMenuContext>[] = [
    {
        label: 'Focus on map',
        title: 'Focus the camera on this map.',
        onClick: ({setCameraParameters, map, selected}) => {
            setCameraParameters(getBaseCameraParameters(map), 1000, selected.mapId);
        },
        show: ({selected, focusMapId}) => (selected.mapId !== focusMapId)
    },
    {
        label: 'Set camera focus point',
        title: 'Set this point as the default camera focus point for this level.',
        onClick: async ({selected, map, scenario, dispatch, setFocusMapId}) => {
            const mapsAtLevel = getMapIdsAtLevel(scenario.maps, map.position.y);
            for (let levelMapId of mapsAtLevel) {
                if (levelMapId !== selected.mapId && scenario.maps[levelMapId].cameraFocusPoint) {
                    dispatch(updateMapCameraFocusPoint(levelMapId));
                }
            }
            dispatch(updateMapCameraFocusPoint(selected.mapId, buildVector3(selected.point).sub(map.position as THREE.Vector3)));
            await promiseSleep(1);
            setFocusMapId(selected.mapId);
        },
        show: (context) => (context.userIsGM)
    },
    {
        label: 'Clear camera focus point',
        title: 'Clear the default camera focus point for this level.',
        onClick: ({map, scenario, dispatch}) => {
            const mapsAtLevel = getMapIdsAtLevel(scenario.maps, map.position.y);
            for (let levelMapId of mapsAtLevel) {
                dispatch(updateMapCameraFocusPoint(levelMapId));
            }
        },
        show: ({map, userIsGM, scenario}) => {
            return userIsGM && getFocusMapIdAndFocusPointAtLevel(scenario.maps, map.position.y).cameraFocusPoint !== undefined;
        }
    },
    {
        label: 'Mute Video',
        title: 'Mute the audio track of this video texture',
        onClick: ({map, dispatch}) => {
            dispatch(updateTabletopVideoMutedAction(map.metadata.id, true));
        },
        show: ({userIsGM, map, tabletop}) => (
            userIsGM && !tabletop.videoMuted[map.metadata.id]
        )
    },
    {
        label: 'Unmute Video',
        title: 'Unmute the audio track of this video texture',
        onClick: ({map, dispatch}) => {
            dispatch(updateTabletopVideoMutedAction(map.metadata.id, false));
        },
        show: ({userIsGM, map, tabletop}) => (
            userIsGM && tabletop.videoMuted[map.metadata.id] === true
        )
    },
    {
        label: 'Reveal',
        title: 'Reveal this map to players',
        onClick: ({selected, dispatch}) => {
            dispatch(updateMapGMOnlyAction(selected.mapId, false))
        },
        show: ({userIsGM, map}) => (userIsGM && map.gmOnly)
    },
    {
        label: 'Hide',
        title: 'Hide this map from players',
        onClick: ({selected, dispatch}) => {
            dispatch(updateMapGMOnlyAction(selected.mapId, true))
        },
        show: ({userIsGM, map}) => (userIsGM && !map.gmOnly)
    },
    {
        label: 'Reposition',
        title: 'Pan, zoom (elevate) and rotate this map on the tabletop.',
        onClick: ({selected, myPeerId, setFocusMapId, dispatch}) => {
            dispatch(updateMapSelectedByAction(selected.mapId, myPeerId));
            setFocusMapId(selected.mapId, false);
        },
        show: ({userIsGM}) => (userIsGM)
    },
    {
        label: 'Lift map one level',
        title: 'Lift this map up to the elevation of the next level above',
        onClick: ({map, selected, dispatch, scenario, setCameraParameters}) => {
            const nextMapUpId = getMapIdOnNextLevel(1, scenario.maps, selected.mapId);
            const deltaVector = new THREE.Vector3(0, nextMapUpId ? scenario.maps[nextMapUpId].position.y - map.position.y + MAP_EPSILON : NEW_MAP_DELTA_Y, 0);
            dispatch(updateMapPositionAction(selected.mapId, deltaVector.clone().add(map.position as THREE.Vector3), null));
            setCameraParameters({
                deltaPosition: deltaVector,
                deltaLookAt: deltaVector
            }, 1000, selected.mapId);
        },
        show: ({userIsGM}) => (userIsGM)
    },
    {
        label: 'Lower map one level',
        title: 'Lower this map down to the elevation of the next level below',
        onClick: ({map, selected, dispatch, scenario, setCameraParameters}) => {
            const nextMapDownId = getMapIdOnNextLevel(-1, scenario.maps, selected.mapId);
            const deltaVector = new THREE.Vector3(0, nextMapDownId ? scenario.maps[nextMapDownId].position.y - map.position.y + MAP_EPSILON : -NEW_MAP_DELTA_Y, 0);
            dispatch(updateMapPositionAction(selected.mapId, deltaVector.clone().add(map.position as THREE.Vector3), null));
            setCameraParameters({
                deltaPosition: deltaVector,
                deltaLookAt: deltaVector
            }, 1000, selected.mapId);
        },
        show: ({userIsGM}) => (userIsGM)
    },
    {
        label: 'Uncover map',
        title: 'Uncover all Fog of War on this map.',
        onClick: async ({selected, confirmLargeFogOfWarAction, dispatch}) => {
            if (await confirmLargeFogOfWarAction([selected.mapId])) {
                dispatch(updateMapFogOfWarAction(selected.mapId));
            }
        },
        show: ({userIsGM, map}) => (userIsGM && map.metadata?.properties?.gridType !== GridType.NONE)
    },
    {
        label: 'Cover map',
        title: 'Cover this map with Fog of War.',
        onClick: async ({selected, confirmLargeFogOfWarAction, dispatch}) => {
            if (await confirmLargeFogOfWarAction([selected.mapId])) {
                dispatch(updateMapFogOfWarAction(selected.mapId, []));
            }
        },
        show: ({userIsGM, map}) => (userIsGM && map.metadata?.properties?.gridType !== GridType.NONE)
    },
    {
        label: 'Enable transparent pixels',
        title: 'Respect transparent or translucent pixels in the map\'s image, and make fog of war transparent (hiding the map\'s overall shape/size).  Enabling may cause visual glitches from certain angles.',
        onClick: ({selected, dispatch}) => {
            dispatch(updateMapTransparencyAction(selected.mapId, true));
        },
        show: ({userIsGM, map}) => (userIsGM && map.transparent)
    },
    {
        label: 'Disable transparent pixels',
        title: 'Treat all pixels on this map as opaque.',
        onClick: ({selected, dispatch}) => {
            dispatch(updateMapTransparencyAction(selected.mapId, false));
        },
        show: ({userIsGM, map}) => (userIsGM && map.transparent)
    },
    {
        label: 'Copy and reposition',
        title: 'Copy this map, and reposition the copy',
        onClick: ({map, setFocusMapId, dispatch, myPeerId}) => {
            const mapId = v4();
            dispatch(addMapAction({...map, selectedBy: myPeerId}, mapId));
            setFocusMapId(mapId, false);
        },
        show: ({userIsGM}) => (userIsGM)
    },
    {
        label: 'Replace map',
        title: 'Replace this map with a different map, preserving the current Fog of War',
        onClick: ({selected, replaceMapImageFn}) => {
            replaceMapImageFn?.(selected.mapId)
        },
        show: ({userIsGM, replaceMapImageFn}) => (userIsGM && replaceMapImageFn !== undefined)
    },
    {
        label: 'Remove map',
        title: 'Remove this map from the tabletop',
        onClick: async ({selected, map, dispatch, scenario, promiseModal}) => {
            const miniIdsOnMap = Object.keys(scenario.minis).filter((miniId) => (scenario.minis[miniId].onMapId === selected.mapId));
            const [hiddenMiniIdsOnMap, visibleMiniIdsOnMap] = partition(miniIdsOnMap, (miniId) => (scenario.minis[miniId].gmOnly));
            const undoGroupId = v4();
            let removeMiniIds: string[] = [];
            let remainingMiniIds: string[] = [];
            if (miniIdsOnMap.length > 0 && promiseModal?.isAvailable()) {
                const removeAll = 'Remove map and its minis';
                const removeFogged = hiddenMiniIdsOnMap.length > 0 ? 'Remove map and its hidden minis' : undefined;
                const cancel = 'Cancel';
                const answer = await promiseModal({
                        children: (
                            <>
                                <p>
                                    The map currently has {miniIdsOnMap.length} piece{miniIdsOnMap.length === 1 ? '' : 's'} on it.
                                </p>
                                <p>
                                    You can remove the map and all minis on it, {hiddenMiniIdsOnMap.length === 0
                                    ? null : ' the map and all hidden minis on it, '} or just the map (leaving
                                    the minis behind, potentially revealing any fogged minis as the Fog of War hiding
                                    them is removed).
                                </p>
                            </>
                        ),
                        options: [removeAll, removeFogged, 'Remove map only', cancel]
                    })
                ;
                if (answer === cancel) {
                    return;
                } else if (answer === removeAll) {
                    removeMiniIds = miniIdsOnMap;
                } else if (removeFogged && answer === removeFogged) {
                    removeMiniIds = hiddenMiniIdsOnMap;
                    remainingMiniIds = visibleMiniIdsOnMap;
                } else {
                    remainingMiniIds = miniIdsOnMap;
                }
            }
            for (let miniId of removeMiniIds) {
                dispatch(undoGroupThunk(removeMiniAction(miniId), undoGroupId));
            }
            if (remainingMiniIds.length > 0) {
                const currentMapY = map.position.y;
                const nextMapDownId = getMapIdOnNextLevel(-1, scenario.maps, selected.mapId);
                if (nextMapDownId || currentMapY > 0) {
                    const newMapY = nextMapDownId ? scenario.maps[nextMapDownId].position.y : 0;
                    for (let miniId of remainingMiniIds) {
                        // Change the elevation of remaining minis so they're based on the next map down.
                        const mini = scenario.minis[miniId];
                        const elevation = mini.elevation + currentMapY - newMapY;
                        dispatch(undoGroupThunk(updateMiniElevationAction(miniId, elevation, null), undoGroupId));
                        dispatch(undoGroupThunk(updateMiniPositionAction(miniId, {
                            ...mini.position,
                            y: newMapY
                        }, null, nextMapDownId), undoGroupId));
                    }
                }
            }
            dispatch(undoGroupThunk(removeMapAction(selected.mapId), undoGroupId));
        },
        show: ({userIsGM}) => (userIsGM)
    },
];