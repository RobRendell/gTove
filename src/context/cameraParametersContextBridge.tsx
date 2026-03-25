import PropTypes from 'prop-types';
import {Component, ContextType, createContext, MutableRefObject, PropsWithChildren, useContext} from 'react';
import {ReactReduxContext} from 'react-redux';
import {Vector3} from 'three';

import {updateGroupCameraAction, updateGroupCameraFocusMapIdAction} from '../redux/deviceLayoutReducer';
import {
    getDeviceLayoutFromStore,
    getMyPeerIdFromStore,
    getScenarioFromStore,
    getTabletopStateFromStore
} from '../redux/mainReducer';
import {
    setTabletopStateFocusMapIdAction,
    setTabletopStateIsLookingDownAction,
    setTabletopStateTopDownAction
} from '../redux/tabletopStateReducer';
import {getBaseCameraParameters, getFocusMapIdAndFocusPointAtLevel} from '../util/scenarioUtils';
import {buildVector3, isTopDown} from '../util/threeUtils';

export interface SetCameraParameters {
    cameraPosition: Vector3;
    cameraLookAt: Vector3;
    deltaPosition: Vector3;
    deltaLookAt: Vector3
}

export type SetCameraParametersFunction = (parameters: Partial<SetCameraParameters>, animate?: number, focusMapId?: string, fromGroup?: boolean) => void;

export interface CameraParametersContext {
    cameraParameters: {
        cameraPositionRef: MutableRefObject<Vector3>;
        cameraLookAtRef: MutableRefObject<Vector3>;

        // Animation-related values
        cameraTargetRef: MutableRefObject<undefined | {
            toPosition: Vector3;
            toLookAt: Vector3;
            startTime: number;
            endTime: number;
        }>;

        setCameraParameters: SetCameraParametersFunction;
        setFocusMapId: (levelMapId?: string, panCamera?: boolean | null) => void;
        getDefaultCameraFocus: (levelMapId?: string | null) => {cameraPosition: Vector3, cameraLookAt: Vector3};
        updateTabletopState: () => void;
        registerChangeCallback: (callback: () => void) => (() => void);
    }
}

export const CameraParametersContextObject = createContext<CameraParametersContext | undefined>(undefined);

interface CameraParametersContextBridgeProps extends PropsWithChildren {
    controlledCameraPosition?: Vector3;
    controlledCameraLookAt?: Vector3;
    controlledCameraAnimation?: number;
}

/** Support both legacy and new context APIs until we finish migrating to the new API. */
export default class CameraParametersContextBridge extends Component<CameraParametersContextBridgeProps> {

    static childContextTypes = {
        cameraParameters: PropTypes.object,
    };

    private readonly cameraPositionRef: MutableRefObject<Vector3> = {current: new Vector3()};
    private readonly cameraLookAtRef: MutableRefObject<Vector3> = {current: new Vector3()};
    private readonly cameraChangedCallbacksRef: MutableRefObject<Set<() => void>> = {current: new Set()};

    // Animation targets
    private readonly cameraTargetRef: CameraParametersContext['cameraParameters']['cameraTargetRef'] = {current: undefined};

    private readonly instanceValues: CameraParametersContext;

    constructor(props: PropsWithChildren) {
        super(props);
        this.instanceValues = {
            cameraParameters: {
                cameraPositionRef: this.cameraPositionRef,
                cameraLookAtRef: this.cameraLookAtRef,
                cameraTargetRef: this.cameraTargetRef,
                setCameraParameters: this.setCameraParameters.bind(this),
                setFocusMapId: this.setFocusMapId.bind(this),
                getDefaultCameraFocus: this.getDefaultCameraFocus.bind(this),
                updateTabletopState: this.updateTabletopState.bind(this),
                registerChangeCallback: this.registerChangeCallback.bind(this),
            }
        };
        const base = getBaseCameraParameters();
        this.cameraPositionRef.current = new Vector3().copy(this.props.controlledCameraPosition ?? base.cameraPosition);
        this.cameraLookAtRef.current = new Vector3().copy(this.props.controlledCameraLookAt ?? base.cameraLookAt);
    }

    getChildContext() {
        return this.instanceValues
    }

    static contextType = ReactReduxContext;
    declare context: ContextType<typeof ReactReduxContext>;

    componentDidUpdate(prevProps: Readonly<CameraParametersContextBridgeProps>) {
        if (
            (this.props.controlledCameraLookAt && (!prevProps.controlledCameraLookAt || !this.props.controlledCameraLookAt.equals(prevProps.controlledCameraLookAt)))
            || (this.props.controlledCameraPosition && (!prevProps.controlledCameraPosition || !this.props.controlledCameraPosition.equals(prevProps.controlledCameraPosition)))
            || (this.props.controlledCameraAnimation && (prevProps.controlledCameraAnimation !== this.props.controlledCameraAnimation))
        ) {
            this.setCameraParameters({
                cameraPosition: this.props.controlledCameraPosition,
                cameraLookAt: this.props.controlledCameraLookAt
            }, this.props.controlledCameraAnimation);
        }
    }

    updateTabletopState() {
        const {topDown, isLookingDown} = getTabletopStateFromStore(this.context.store.getState());
        const nextTopDown = isTopDown(this.cameraPositionRef.current, this.cameraLookAtRef.current);
        if (nextTopDown !== topDown) {
            this.context.store.dispatch(setTabletopStateTopDownAction(nextTopDown));
        }
        const nextIsLookingDown = this.cameraLookAtRef.current.y < this.cameraPositionRef.current.y;
        if (nextIsLookingDown !== isLookingDown) {
            this.context.store.dispatch(setTabletopStateIsLookingDownAction(nextIsLookingDown));
        }
    }

    setCameraParameters(cameraParameters: Partial<SetCameraParameters>, animate = 0, focusMapId?: string, fromGroup = false) {
        const store = this.context.store;
        const myPeerId = getMyPeerIdFromStore(store.getState());
        const deviceLayout = getDeviceLayoutFromStore(store.getState());
        const position = cameraParameters.deltaPosition
            ? this.cameraPositionRef.current.clone().add(cameraParameters.deltaPosition)
            : cameraParameters.cameraPosition;
        const lookAt = cameraParameters.deltaLookAt
            ? this.cameraLookAtRef.current.clone().add(cameraParameters.deltaLookAt)
            : cameraParameters.cameraLookAt;
        if (lookAt || position || focusMapId) {
            if (animate) {
                const startTime = Date.now();
                const endTime = startTime + animate;
                this.cameraTargetRef.current = {
                    toPosition: position ?? this.cameraPositionRef.current.clone(),
                    toLookAt: lookAt ?? this.cameraLookAtRef.current.clone(),
                    startTime,
                    endTime
                }
            } else {
                if (position) {
                    this.cameraPositionRef.current.copy(position);
                }
                if (lookAt) {
                    this.cameraLookAtRef.current.copy(lookAt);
                }
                this.cameraTargetRef.current = undefined;
                this.updateTabletopState();
            }
            if (focusMapId !== undefined) {
                store.dispatch(setTabletopStateFocusMapIdAction(focusMapId || undefined));
            }
            this.cameraChangedCallbacksRef.current.forEach((callback) => (callback()));
        }
        if (!fromGroup && myPeerId && deviceLayout.layout[myPeerId]) {
            // We're part of a combined display, so also update the group display
            store.dispatch(updateGroupCameraAction(myPeerId, deviceLayout.layout[myPeerId].deviceGroupId, cameraParameters, animate, focusMapId));
        }
    }

    lookAtPointPreservingViewAngle(newCameraLookAt: Vector3): Vector3 {
        // Simply shift the cameraPosition by the same delta as we're shifting the cameraLookAt.
        return newCameraLookAt.clone().sub(this.cameraLookAtRef.current).add(this.cameraPositionRef.current);
    }

    /**
     * Given a levelMapId, find the actual ID of the best map on that level to focus on, and the selected or default
     * 3D focus point for the level.
     *
     * @param levelMapId The mapId of a map on the level.  If null or undefined, default to the level at elevation 0.
     * @param panCamera If true, the cameraLookAt will be the focus point for the level (if no explicit focus point is
     * set, it will be the centre of the focusMapId).  If false, the cameraLookAt will be the same as the current
     * camera's from this.state, except the elevation will that of focusMapId.  If null, act like panCamera is true if
     * focusMapId has an explicit focus point, false if not.
     * @returns {focusMapId, cameraLookAt} The id of the best mapId on the level (e.g. the highest one with the lowest
     * mapId which has an explicit map focus point set), and the cameraLookAt for that map, as controlled by the
     * parameters.
     */
    getLevelCameraLookAtAndFocusMapId(levelMapId: string | null | undefined, panCamera: boolean | null) {
        const scenario = getScenarioFromStore(this.context.store.getState());
        const levelMap = levelMapId ? scenario.maps[levelMapId] : undefined;
        const elevation = levelMap?.position.y ?? 0;
        const {focusMapId, cameraFocusPoint} = getFocusMapIdAndFocusPointAtLevel(scenario.maps, elevation);
        const focusMap = focusMapId ? scenario.maps[focusMapId] : undefined;
        const cameraLookAt = (panCamera || (panCamera === null && cameraFocusPoint)) ? (
            (focusMapId && cameraFocusPoint) ? buildVector3(cameraFocusPoint)
                : buildVector3(focusMap?.position)
        ) : (
            new Vector3(this.cameraLookAtRef.current.x, focusMap?.position.y ?? 0, this.cameraLookAtRef.current.z)
        );
        return {focusMapId, cameraLookAt};
    }

    setFocusMapId(levelMapId: string | undefined, panCamera: boolean | null = true) {
        const state = this.context.store.getState();
        const scenario = getScenarioFromStore(state);
        const myPeerId = getMyPeerIdFromStore(state);
        const deviceLayout = getDeviceLayoutFromStore(state);
        const tabletopState = getTabletopStateFromStore(state);
        const {focusMapId, cameraLookAt} = this.getLevelCameraLookAtAndFocusMapId(levelMapId, panCamera);
        const cameraPosition = tabletopState.focusMapId || !focusMapId ? this.lookAtPointPreservingViewAngle(cameraLookAt)
            : getBaseCameraParameters(scenario.maps[focusMapId], 1, cameraLookAt).cameraPosition;
        this.setCameraParameters({cameraPosition, cameraLookAt}, 1000, focusMapId);
        if (myPeerId && deviceLayout.layout[myPeerId]) {
            this.context.store.dispatch(updateGroupCameraFocusMapIdAction(deviceLayout.layout[myPeerId].deviceGroupId, focusMapId));
        }
    }

    getDefaultCameraFocus(levelMapId?: string | null) {
        const scenario = getScenarioFromStore(this.context.store.getState());
        if (levelMapId === undefined) {
            levelMapId = getTabletopStateFromStore(this.context.store.getState()).focusMapId;
        }
        const {focusMapId, cameraLookAt} = this.getLevelCameraLookAtAndFocusMapId(levelMapId, true);
        return getBaseCameraParameters(focusMapId ? scenario.maps[focusMapId] : undefined, 1, cameraLookAt);
    }

    registerChangeCallback(callback: () => void) {
        this.cameraChangedCallbacksRef.current.add(callback);
        return () => {
            this.cameraChangedCallbacksRef.current.delete(callback);
        }
    }

    render() {
        return (
            <CameraParametersContextObject.Provider value={this.instanceValues}>
                {this.props.children}
            </CameraParametersContextObject.Provider>
        );
    }
}

export function useCameraParameters() {
    const value = useContext(CameraParametersContextObject);
    if (!value) {
        throw new Error('Call useCameraParameters from inside a CameraParametersContextBridge')
    }
    return value.cameraParameters;
}
