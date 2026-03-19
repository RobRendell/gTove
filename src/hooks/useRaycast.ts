import {useThree} from '@react-three/fiber';
import {useCallback, useMemo, useRef} from 'react';
import {useStore} from 'react-redux';
import {Intersection, Object3D, Plane, Raycaster, Vector2, Vector3} from 'three';

import {RayCastField, RayCastIntersect} from '../presentation/tabletopViewComponent';
import {getScenarioFromStore, getTabletopStateFromStore} from '../redux/mainReducer';
import TextureService from '../service/textureService';
import {isFogOfWarAtPoint, ObjectVector2} from '../util/scenarioUtils';
import {useUserIsGM} from './useUserIsGM';

export function useRaycast() {
    const rayPointRef = useRef(new Vector2());
    const raycasterRef = useRef(new Raycaster());
    const userIsGM = useUserIsGM();
    const store = useStore();
    const {camera, scene, size: {width, height}} = useThree();

    const raycastFromScreen = useCallback((position: ObjectVector2) => {
        rayPointRef.current.x = 2 * position.x / width - 1;
        rayPointRef.current.y = 1 - 2 * position.y / height;
        raycasterRef.current.setFromCamera(rayPointRef.current, camera);
        return raycasterRef.current.intersectObjects(scene.children, true);
    }, [camera, height, scene.children, width]);

    const mapIntersectionToRayCastIntersect = useCallback(<T extends RayCastField, U extends Extract<RayCastIntersect, {type: T}>>(
        intersection: Intersection, fieldsArray: T[], position: ObjectVector2
    ): U | null => {
        const ancestor = findAncestorWithUserDataFields(intersection, fieldsArray);
        if (!ancestor) {
            return null;
        }
        const userData = ancestor.object.userData;
        const {dragMode, playerView} = getTabletopStateFromStore(store.getState());
        const scenario = getScenarioFromStore(store.getState());
        if (userData.mapId && dragMode !== 'fogOfWarMode') {
            const map = scenario.maps[userData.mapId];
            if (map.transparent) {
                // A player raycast that hits Fog of War on a transparent map just passes through.
                if ((!userIsGM || playerView) && isFogOfWarAtPoint(map, intersection.point)) {
                    return null;
                }
                // Likewise for a transparent pixel on the map's texture (if it has been loaded).
                const textureResult = TextureService.getTextureSync(map.metadata);
                if (textureResult && intersection.uv && textureResult.texture.image instanceof HTMLCanvasElement) {
                    const context = textureResult.texture.image.getContext('2d');
                    if (context) {
                        const x = Math.round(textureResult.texture.image.width * intersection.uv.x);
                        const y = Math.round(textureResult.texture.image.height * (1 - intersection.uv.y));
                        const imageData = context.getImageData(x, y, 1, 1);
                        if (imageData.data[3] === 0) {
                            return null;
                        }
                    }
                }
            }
        }
        return {
            ...userData,
            type: ancestor.field,
            point: intersection.point,
            position,
            object: intersection.object
        } as U;
    }, [store, userIsGM]);

    const raycastForFirstUserDataFields = useCallback(<T extends RayCastField, U extends Extract<RayCastIntersect, {type: T}>>(
        position: ObjectVector2, fields: T | T[]
    ): U | null => {
        const intersects = raycastFromScreen(position);
        const fieldsArray = Array.isArray(fields) ? fields : [fields];
        return intersects.reduce<U | null>((selected, intersection) => (
            selected ?? mapIntersectionToRayCastIntersect(intersection, fieldsArray, position)
        ), null);
    }, [mapIntersectionToRayCastIntersect, raycastFromScreen]);

    const raycastForAllUserDataFields = useCallback(<T extends RayCastField, U extends Extract<RayCastIntersect, {type: T}>>(
        position: ObjectVector2, fields: T | T[]
    ): U[] => {
        const intersects = raycastFromScreen(position);
        const fieldsArray = Array.isArray(fields) ? fields : [fields];
        let inResult: any = {};
        return intersects
            .map((intersection) => (
                mapIntersectionToRayCastIntersect(intersection, fieldsArray, position)
            ))
            .filter((intersect): intersect is U => (intersect !== null))
            .filter((intersect: RayCastIntersect) => {
                let id = (intersect.type === 'dieRollId') ? intersect.dieId :
                    (intersect.type === 'mapId') ? intersect.mapId : intersect.miniId;
                if (inResult[id]) {
                    return false;
                } else {
                    inResult[id] = true;
                    return true;
                }
            });
    }, [mapIntersectionToRayCastIntersect, raycastFromScreen]);

    const planeRef = useRef(new Plane());
    const resultPointRef = useRef(new Vector3());
    const raycastToMapOrPlane = useCallback((position: ObjectVector2, planeY: number) => {
        const intersection = raycastForFirstUserDataFields(position, 'mapId');
        if (intersection) {
            resultPointRef.current.copy(intersection.point);
            return {mapId: intersection.mapId, position: resultPointRef.current};
        }
        planeRef.current.setComponents(0, -1, 0, planeY);
        raycasterRef.current.ray.intersectPlane(planeRef.current, resultPointRef.current);
        return {position: resultPointRef.current};
    }, [raycastForFirstUserDataFields]);

    const raycastToPlane = useCallback((position: ObjectVector2, planeY: number) => {
        rayPointRef.current.x = 2 * position.x / width - 1;
        rayPointRef.current.y = 1 - 2 * position.y / height;
        raycasterRef.current.setFromCamera(rayPointRef.current, camera);
        planeRef.current.setComponents(0, -1, 0, planeY);
        return raycasterRef.current.ray.intersectPlane(planeRef.current, resultPointRef.current);
    }, [camera, height, width]);

    return useMemo(() => ({
        raycastForFirstUserDataFields,
        raycastForAllUserDataFields,
        raycastToMapOrPlane,
        raycastToPlane,
        raycaster: raycasterRef.current
    }), [raycastForAllUserDataFields, raycastForFirstUserDataFields, raycastToMapOrPlane, raycastToPlane]);
}

function findAncestorWithUserDataFields(intersect: Intersection, fields: RayCastField[]): {object: Object3D, field: RayCastField} | null {
    for (let object: any = intersect.object; object && object.type !== 'LineSegments'; object = object.parent) {
        const field = object.userData && fields.find((field) => (object.userData[field]));
        if (field) {
            return {object, field};
        }
    }
    return null;
}