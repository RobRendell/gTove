import './miniEditor.scss';

import clamp from 'lodash/clamp';
import {FunctionComponent, SyntheticEvent, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import ReactDropdown, {Option} from 'react-dropdown-now';
import ReactResizeDetector from 'react-resize-detector';
import {Vector3} from 'three';

import ColourPicker from '../container/colourPicker';
import GestureControls, {GestureHandler} from '../container/gestureControls';
import InputField from '../container/inputField';
import {PromiseModalContextObject} from '../context/promiseModalProvider';
import {MINI_CORNER_RADIUS_PERCENT} from '../three/tabletopMiniComponent';
import {MINI_HEIGHT, MINI_WIDTH} from '../util/constants';
import {
    calculateMiniProperties,
    getColourHex,
    getColourHexString,
    GRID_COLOUR,
    ObjectVector2,
    ScenarioType
} from '../util/scenarioUtils';
import {FileMetadata, MiniProperties, PieceVisibilityEnum, TextureLoader} from '../util/storage/storageContract';
import {isSupportedVideoMimeType} from '../util/storage/storageUtils';
import {isSizedEvent} from '../util/types';
import InputButton from './inputButton';
import RenameFileEditor from './renameFileEditor';
import TabletopPreviewComponent from './tabletopPreviewComponent';
import VisibilitySlider from './visibilitySlider';

const CAMERA_POSITION_ISOMETRIC = new Vector3(0, 2, 3);
const CAMERA_POSITION_TOP_DOWN = new Vector3(0, 4, 0.5);
const CAMERA_LOOK_AT = new Vector3(0, 0, 0);

const DEFAULT_SCALE_OTHER = 'other';
const DEFAULT_SCALE_OPTIONS: Option[] = [
    {label: '¼', value: '0.25'}, {label: '½', value: '0.5'}, {label: '1', value: '1'}, {label: '2', value: '2'},
    {label: '3', value: '3'}, {label: 'Other', value: DEFAULT_SCALE_OTHER}
];

interface MiniEditorProps {
    metadata: FileMetadata<void, MiniProperties>;
    onClose: () => void;
    textureLoader: TextureLoader;
}

const MiniEditor: FunctionComponent<MiniEditorProps> = ({metadata, onClose, textureLoader}) => {
    const promiseModal = useContext(PromiseModalContextObject);

    const [properties, setProperties] = useState<MiniProperties>(calculateMiniProperties(metadata.properties!));
    const [textureUrl, setTextureUrl] = useState<string>();
    const [cameraPosition, setCameraPosition] = useState(CAMERA_POSITION_ISOMETRIC);
    const [loadError, setLoadError] = useState<string>();
    const [movingFrame, setMovingFrame] = useState(false);
    const [editImagePanelWidth, setEditImagePanelWidth] = useState(0);
    const [editImagePanelHeight, setEditImagePanelHeight] = useState(0);
    const [isTopDown, setIsTopDown] = useState(false);
    const [selectedOption, setSelectedOption] = useState<Option>(
        DEFAULT_SCALE_OPTIONS.find((option) => (option.value === String(properties.scale)))
        ?? DEFAULT_SCALE_OPTIONS[DEFAULT_SCALE_OPTIONS.length - 1]
    );

    const showOtherScale = (selectedOption.value === DEFAULT_SCALE_OTHER);

    const updateCameraPosition = useCallback((topDown = isTopDown, scale = properties.scale) => {
        const zoom = Math.max(1, scale);
        const nextPosition = topDown ? CAMERA_POSITION_TOP_DOWN : CAMERA_POSITION_ISOMETRIC;
        setCameraPosition(zoom === 1 ? nextPosition : nextPosition.clone().multiplyScalar(zoom));
    }, [isTopDown, properties.scale]);

    const setScale = useCallback((scale: number) => {
        setProperties((properties) => (calculateMiniProperties(properties, {scale})));
        updateCameraPosition(undefined, scale);
    }, [updateCameraPosition]);
    useEffect(() => {
        if (selectedOption.value !== DEFAULT_SCALE_OTHER) {
            setScale(+selectedOption.value);
        }
    }, [selectedOption.value, setScale]);

    useEffect(() => {
        setProperties((prev) => (calculateMiniProperties(metadata.properties!, prev)));
        setTextureUrl(undefined);
    }, [metadata.id, metadata.properties]);

    useEffect(() => {
        textureLoader.loadImageBlob(metadata)
            .then((blob) => {
                setTextureUrl(window.URL.createObjectURL(blob));
            })
            .catch((error) => {
                setLoadError(error);
            });
    }, [metadata, textureLoader]);

    const getSaveMetadata = useCallback(() => (
        {properties: calculateMiniProperties(properties)}
    ), [properties]);

    const onTopDownChanged = useCallback(() => {
        setIsTopDown((previous) => {
            const nextTopDown = !previous;
            updateCameraPosition(nextTopDown);
            return nextTopDown;
        });
    }, [updateCameraPosition]);

    const onResize = useCallback((width?: number, height?: number) => {
        if (width !== undefined && height !== undefined) {
            setEditImagePanelWidth(width);
            setEditImagePanelHeight(height);
        }
    }, []);

    const maxDimensions = useMemo(() => (
        Math.max(Number(properties.height), Number(properties.width))
    ), [properties.height, properties.width]);

    // Gesture handling
    const onPan = useCallback((delta: ObjectVector2) => {
        if (movingFrame) {
            if (isTopDown) {
                setProperties((properties) => (
                    calculateMiniProperties(properties, {
                        topDownX: Number(properties.topDownX) + delta.x / maxDimensions,
                        topDownY: Number(properties.topDownY) - delta.y / maxDimensions
                    })
                ));
            } else {
                setProperties((properties) => (
                    calculateMiniProperties(properties, {
                        standeeX: Number(properties.standeeX) + delta.x / maxDimensions,
                        standeeY: Number(properties.standeeY) - delta.y / maxDimensions
                    })
                ));
            }
        }
    }, [isTopDown, maxDimensions, movingFrame]);
    const onZoom = useCallback((delta: ObjectVector2) => {
        setProperties((properties) => {
            if (isTopDown) {
                const aspectRatio = Number(properties.aspectRatio);
                const maxRadius = ((aspectRatio < 1) ? 1 / aspectRatio : aspectRatio);
                return calculateMiniProperties(properties, {
                    topDownRadius: clamp(Number(properties.topDownRadius) - delta.y / maxDimensions, 0.2, maxRadius)
                });
            } else {
                const beforeAspect = Number(properties.standeeRangeX) / Number(properties.standeeRangeY);
                const standeeRangeX = clamp(Number(properties.standeeRangeX) + delta.y / maxDimensions, 0.2, 3);
                const standeeRangeY = standeeRangeX / beforeAspect;
                return calculateMiniProperties(properties, {standeeRangeX, standeeRangeY});
            }
        });
    }, [isTopDown, maxDimensions]);
    const onGestureEnd = useCallback(() => {
        setMovingFrame(false);
    }, []);
    const gestureHandler = useMemo<GestureHandler>(() => ({
        id: 'miniEditor',
        onPan,
        onZoom,
        onGestureEnd
    }), [onGestureEnd, onPan, onZoom]);

    const scenario = useMemo<ScenarioType>(() => ({
        updateSideEffect: false,
        snapToGrid: true,
        confirmMoves: false,
        headActionId: null,
        playerHeadActionId: null,
        maps: {},
        minis: {
            previewMini: {
                metadata: {...metadata, properties},
                name: '',
                position: {x: 0, y: 0, z: 0},
                rotation: {x: 0, y: 0, z: 0, order: 'XYZ'},
                scale: properties.scale || 1,
                elevation: 0,
                visibility: PieceVisibilityEnum.REVEALED,
                gmOnly: false,
                selectedBy: null,
                locked: true,
                prone: false,
                flat: false,
                hideBase: false,
                piecesRosterValues: {},
                piecesRosterGMValues: {},
                piecesRosterSimple: true
            }
        }
    }), [metadata, properties]);

    const imageScale = useMemo(() => (
        Math.min(1, (editImagePanelWidth && editImagePanelHeight && properties.width && properties.height) ?
            0.75 * Math.min(
                editImagePanelWidth / properties.width / MINI_WIDTH,
                editImagePanelHeight / properties.height / MINI_HEIGHT
            ) : 1)
    ), [editImagePanelHeight, editImagePanelWidth, properties.height, properties.width]);

    const frameStyle = useMemo(() => {
        if (isTopDown) {
            const radius = maxDimensions * Number(properties.topDownRadius);
            const topDownLeft = maxDimensions * Number(properties.topDownX) - radius;
            const topDownBottom = maxDimensions * Number(properties.topDownY) - radius;
            return {width: 2 * radius, height: 2 * radius, left: topDownLeft, bottom: topDownBottom};
        } else {
            const imageWidth = Number(properties.width);
            const imageHeight = Number(properties.height);
            if (!imageWidth || !imageHeight) {
                return undefined;
            }
            const frameWidth = imageWidth / Number(properties.standeeRangeX);
            const frameHeight = imageHeight * MINI_HEIGHT / Number(properties.standeeRangeY);
            const frameLeft = (imageWidth * Number(properties.standeeX)) - frameWidth / 2;
            const frameBottom = imageHeight * Number(properties.standeeY);
            const borderRadius = MINI_CORNER_RADIUS_PERCENT + '% ' + MINI_CORNER_RADIUS_PERCENT + '% 0 0';
            return {borderRadius, left: frameLeft, bottom: frameBottom, width: frameWidth, height: frameHeight};
        }
    }, [isTopDown, maxDimensions, properties]);

    const onStartMoving = useCallback(() => {
        setMovingFrame(true);
    }, []);

    return (
        <RenameFileEditor
            className='miniEditor'
            metadata={metadata}
            onClose={onClose}
            getSaveMetadata={getSaveMetadata}
            controls={[
                <InputButton key='topDownButton' type='checkbox' selected={isTopDown} onChange={onTopDownChanged}>
                    View mini top-down
                </InputButton>,
                <InputButton key='colourControls' type='button' onChange={async () => {
                    if (promiseModal?.isAvailable()) {
                        let colour = properties.colour;
                        const okOption = 'OK';
                        const defaultOption = 'Use Top Left Pixel';
                        const result = await promiseModal({
                            children: (
                                <div>
                                    <p>Set background colour</p>
                                    <ColourPicker
                                        disableAlpha={true}
                                        initialColour={getColourHex((colour || GRID_COLOUR.white) as GRID_COLOUR)}
                                        onColourChange={(colourObj) => {
                                            colour = colourObj.hex;
                                        }}
                                    />
                                </div>
                            ),
                            options: [okOption, defaultOption, 'Cancel']
                        });
                        setProperties((prev) => ({
                            ...prev,
                            colour: (result === okOption) ? getColourHexString(colour || 0) : undefined
                        }));
                    }
                }}>
                    Background:
                    {
                        properties.colour ? (
                            <span className='backgroundColourSwatch' style={{backgroundColor: properties.colour}}>&nbsp;</span>
                        ) : (
                            <span>(top left pixel)</span>
                        )
                    }
                </InputButton>,
                <div className='defaultScale' key='defaultScale'>
                    <span>Default scale:&nbsp;</span>
                    <ReactDropdown
                        className='scaleSelect'
                        placeholder=''
                        options={DEFAULT_SCALE_OPTIONS}
                        value={selectedOption}
                        onChange={setSelectedOption}
                    />
                    {
                        (selectedOption.value !== DEFAULT_SCALE_OTHER && !showOtherScale) ? null : (
                            <InputField type='number'
                                        className='otherScale'
                                        updateOnChange={true}
                                        initialValue={properties.scale}
                                        minValue={0}
                                        onChange={setScale}
                                        onBlur={(scale: number) => {
                                            if (scale < 0.1) {
                                                setScale(0.1);
                                            }
                                        }}
                            />
                        )
                    }
                </div>,
                <div className='defaultVisibility' key='defaultVisibility'>
                    <span>Default visibility:&nbsp;</span>
                    <VisibilitySlider visibility={properties.defaultVisibility || PieceVisibilityEnum.FOGGED} onChange={(value) => {
                        setProperties(calculateMiniProperties(properties, {defaultVisibility: value}));
                    }} />
                </div>
            ]}
        >
            {
                loadError ? (
                    <span>An error occurred while loading this file from Google Drive: {loadError}</span>
                ) : !textureUrl ? (
                    <span>Loading...</span>
                ) : (
                    <div className='editorPanels'>
                        <GestureControls className='editImagePanel' defaultHandler={gestureHandler}>
                            <ReactResizeDetector handleWidth={true} handleHeight={true} onResize={onResize}/>
                            <div className='miniImageDiv' style={{transform: `translate(-50%, -50%) scale(${imageScale})`}}>
                                {
                                    isSupportedVideoMimeType(metadata.mimeType) ? (
                                        <video loop={true} autoPlay={true} src={textureUrl} onLoadedMetadata={(evt: SyntheticEvent<HTMLVideoElement>) => {
                                            setProperties((properties) => (calculateMiniProperties(properties, {
                                                width: evt.currentTarget.videoWidth,
                                                height: evt.currentTarget.videoHeight
                                            })));
                                        }}>
                                            Your browser doesn't support embedded videos.
                                        </video>
                                    ) : (
                                        <img src={textureUrl} alt='mini' onLoad={(evt) => {
                                            window.URL.revokeObjectURL(textureUrl);
                                            if (isSizedEvent(evt)) {
                                                setProperties((properties) => (calculateMiniProperties(properties, {
                                                    width: evt.target.width,
                                                    height: evt.target.height
                                                })));
                                            }
                                        }}/>
                                    )
                                }
                                <div
                                    className={isTopDown ? 'topDownFrame' : 'standeeFrame'}
                                    style={frameStyle}
                                    onMouseDown={onStartMoving}
                                    onTouchStart={onStartMoving}
                                />
                            </div>
                        </GestureControls>
                        <TabletopPreviewComponent
                            scenario={scenario}
                            cameraLookAt={CAMERA_LOOK_AT}
                            cameraPosition={cameraPosition}
                            cameraAnimation={500}
                            topDown={isTopDown}
                            topDownChanged={setIsTopDown}
                        />
                    </div>
                )
            }
        </RenameFileEditor>
    );
}

export default MiniEditor;