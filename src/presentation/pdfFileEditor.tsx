import './pdfFileEditor.scss';

import clamp from 'lodash/clamp';
import {GlobalWorkerOptions} from 'pdfjs-dist';
import PdfJsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import {OptionalContentConfig} from 'pdfjs-dist/types/src/display/optional_content_config';
import {CSSProperties, FunctionComponent, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {useSelector} from 'react-redux';
import ReactResizeDetector from 'react-resize-detector';

import BrowseFilesComponent from '../container/browseFilesComponent';
import GestureControls, {GestureHandler} from '../container/gestureControls';
import InputField from '../container/inputField';
import {FileAPIContextObject} from '../context/fileAPIProvider';
import {getAllFilesFromStore, getFolderStacksFromStore} from '../redux/mainReducer';
import * as constants from '../util/constants';
import {FOLDER_MAP, FOLDER_MINI} from '../util/constants';
import {ObjectVector2} from '../util/scenarioUtils';
import {FileMetadata, MapProperties, MiniProperties} from '../util/storage/storageContract';
import InputButton from './inputButton';
import MapEditor from './mapEditor';
import MiniEditor from './miniEditor';
import PdfViewer, {PDF_WRAPPER_MARGIN} from './pdfViewer';
import RenameFileEditor from './renameFileEditor';

/** The max distance from the drag border to be considered for crop rect resizing. */
const CROP_ADJUSTMENT_DRAG_MARGIN = 32;

enum CropAdjustment {
    NONE = 0,
    RESIZING,
    RESIZING_HORZ,
    RESIZING_VERT,
    POSITIONING,
}

interface PdfFileEditorProps {
    metadata: FileMetadata<void, void>;
    onClose: () => void;
    onSave?: (metadata: FileMetadata<void, void>) => Promise<any>;
}

const PdfFileEditor: FunctionComponent<PdfFileEditorProps> = ({metadata, onSave, onClose}) => {
    if (!GlobalWorkerOptions.workerSrc) {
        GlobalWorkerOptions.workerSrc = PdfJsWorkerUrl;
    }

    const fileAPI = useContext(FileAPIContextObject);
    const folderStacks = useSelector(getFolderStacksFromStore);
    const files = useSelector(getAllFilesFromStore);

    const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const canvasWrapperRef = useRef<HTMLDivElement | null>(null);
    const savingCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const [browseSavePath, setBrowseSavePath] = useState(false);
    const [saving, setSaving] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [numPages, setNumPages] = useState(0);
    const [contentConfig, setContentConfig] = useState<OptionalContentConfig | undefined>();
    const [zoomFactor, setZoomFactor] = useState(1);
    const [adjustingCropRectangle, setAdjustingCropRectangle] = useState(CropAdjustment.NONE);
    const [prepareSaveCrop, setPrepareSaveCrop] = useState(false);
    const [savingCrop, setSavingCrop] = useState(false);
    const [isSavingMap, setIsSavingMap] = useState(false);
    const [savingCanvasRotation, setSavingCanvasRotation] = useState(0);
    const [pdfPanelSize, setPdfPanelSize] = useState<{width?: number; height?: number}>({});
    const [cropPoints, setCropPoints] = useState<ObjectVector2[] | undefined>();
    const [editCrop, setEditCrop] = useState<FileMetadata | undefined>();
    const [pdfCanvasSize, setPdfCanvasSize] = useState<{width: number; height: number} | undefined>();

    const onResize = useCallback((width?: number, height?: number) => {
        setPdfPanelSize({width, height});
    }, []);

    const onPdfLoaded = useCallback((numPages: number, contentConfig?: OptionalContentConfig) => {
        setNumPages(numPages);
        setContentConfig(contentConfig);
    }, [])
    
    const updateCurrentPage = useCallback(async (currentPage: number) => {
        if (currentPage < 1) {
            currentPage = 1;
        } else if (currentPage > numPages) {
            currentPage = numPages;
        }
        setCurrentPage(currentPage);
    }, [numPages]);

    const confirmCurrentPage = useCallback(() => {
        void updateCurrentPage(currentPage);
    }, [currentPage, updateCurrentPage]);

    const onPdfSave = useCallback(async (saveMetadata: FileMetadata<void, void>) => {
        setSaving(true);
        await onSave?.(saveMetadata);
        setSaving(false);
    }, [onSave]);

    const cropRectangle = useMemo(() => (
        !cropPoints ? undefined : {
            left: Math.min(cropPoints[0].x, cropPoints[1].x),
            right: Math.max(cropPoints[0].x, cropPoints[1].x),
            top: Math.min(cropPoints[0].y, cropPoints[1].y),
            bottom: Math.max(cropPoints[0].y, cropPoints[1].y)
        }
    ), [cropPoints]);

    const adjustZoomFactor = useCallback((adjust: number) => {
        setZoomFactor((zoomFactor) => {
            const newZoomFactor = adjust * zoomFactor;
            // Keep scrolled window centred.
            if (canvasWrapperRef.current && pdfCanvasRef.current) {
                const {scrollTop, scrollLeft, clientWidth: wrapperWidth, clientHeight: wrapperHeight} = canvasWrapperRef.current;
                const {width, height} = pdfCanvasRef.current;
                const halfWidth = Math.min(wrapperWidth, width) / 2;
                const halfHeight = Math.min(wrapperHeight, height) / 2;
                canvasWrapperRef.current.scrollTop = (scrollTop + halfHeight) * newZoomFactor / zoomFactor - halfHeight;
                canvasWrapperRef.current.scrollLeft = (scrollLeft + halfWidth) * newZoomFactor / zoomFactor - halfWidth;
            }
            // Also adjust cropPoints if it's set
            setCropPoints((cropRectangle) => (
                !cropRectangle ? undefined : cropRectangle.map((point) => ({
                    x: point.x / zoomFactor * newZoomFactor,
                    y: point.y / zoomFactor * newZoomFactor
                }))
            ));
            return newZoomFactor;
        });
    }, []);

    const onGestureStart = useCallback((startPos: ObjectVector2) => {
        if (savingCanvasRef.current) {
            return;
        }
        const canvas = pdfCanvasRef.current!;
        if (!isPointWithinBounds(startPos.x, startPos.y, 0, 0, canvas.width, canvas.height)) {
            return;
        }
        if (cropRectangle) {
            const {left, top, right, bottom} = cropRectangle;
            const {x: startX, y: startY} = startPos;
            const margin = CROP_ADJUSTMENT_DRAG_MARGIN;
            if (isPointWithinBounds(startX, startY, left - margin, top - margin, right + margin, bottom + margin)
                && !isPointWithinBounds(startX, startY, left + margin, top + margin, right - margin, bottom - margin)) {
                // Resize time!
                const centerX = (left + right) / 2;
                const centerY = (top + bottom) / 2;
                const x = startX < centerX ? right : left;
                const y = startY < centerY ? bottom : top;
                if (startX <= left + margin || startX >= right - margin) {
                    if (startY <= top + margin || startY >= bottom - margin) {
                        setAdjustingCropRectangle(CropAdjustment.RESIZING);
                        setCropPoints([{x, y}, startPos]);
                    } else {
                        setAdjustingCropRectangle(CropAdjustment.RESIZING_HORZ);
                        setCropPoints([{x, y}, {x: startPos.x, y: bottom + top - y}]);
                    }
                } else if (startY <= top + margin || startY >= bottom - margin) {
                    setAdjustingCropRectangle(CropAdjustment.RESIZING_VERT);
                    setCropPoints([{x, y}, {x: left + right - x, y: startPos.y}]);
                } else {
                    setAdjustingCropRectangle(CropAdjustment.RESIZING);
                    setCropPoints([{x, y}, startPos]);
                }
            } else {
                // Reposition time!
                setAdjustingCropRectangle(CropAdjustment.POSITIONING);
                setCropPoints([{x: left, y: top}, {x: right, y: bottom}, startPos]);
            }
        } else {
            setAdjustingCropRectangle(CropAdjustment.RESIZING);
            setCropPoints([startPos, startPos]);
        }
    }, [cropRectangle]);
    const onPan = useCallback((_delta: ObjectVector2, position: ObjectVector2) => {
        if (adjustingCropRectangle === CropAdjustment.NONE) {
            return;
        }
        // We are adjusting crop rectangles.
        const canvas = pdfCanvasRef.current!;
        const maxWidth = canvas.width - 1;
        const maxHeight = canvas.height - 1;
        setCropPoints((cropRectangle) => {
            if (!cropRectangle) {
                return cropRectangle;
            }
            const v1 = cropRectangle[0];
            const v2 = cropRectangle[1];
            if (adjustingCropRectangle === CropAdjustment.POSITIONING) {
                const v3 = cropRectangle[2];
                const deltaX = position.x - v3.x;
                const deltaY = position.y - v3.y;
                return [
                    { x: clamp(v1.x + deltaX, 0, maxWidth), y: clamp(v1.y + deltaY, 0, maxHeight) },
                    { x: clamp(v2.x + deltaX, 0, maxWidth), y: clamp(v2.y + deltaY, 0, maxHeight) },
                    position
                ];
            }
            return adjustingCropRectangle === CropAdjustment.RESIZING ? [
                v1, {x: clamp(position.x, 0, maxWidth), y: clamp(position.y, 0, maxHeight)}
            ] : adjustingCropRectangle === CropAdjustment.RESIZING_HORZ ? [
                v1, {x: clamp(position.x, 0, maxWidth), y: v2.y}
            ] : [
                v1, {x: v2.x, y: clamp(position.y, 0, maxHeight)}
            ];
        })
    }, [adjustingCropRectangle]);
    const onGestureEnd = useCallback(() => {
        setAdjustingCropRectangle(CropAdjustment.NONE);
    }, []);
    const gestureHandler = useMemo<GestureHandler>(() => ({
        id: 'pdfFileEditor',
        onGestureStart,
        onPan,
        onGestureEnd
    }), [onGestureEnd, onGestureStart, onPan]);

    const cropStyle = useMemo(() => (
        (!cropRectangle || prepareSaveCrop || editCrop || !pdfCanvasSize) ? undefined : {
            left: cropRectangle.left,
            top: cropRectangle.top,
            right: pdfCanvasSize.width - cropRectangle.right,
            bottom: pdfCanvasSize.height - cropRectangle.bottom
        }
    ), [cropRectangle, editCrop, pdfCanvasSize, prepareSaveCrop]);

    const updateSavingCanvas = useCallback(() => {
        if (savingCanvasRef.current && pdfCanvasRef.current && cropRectangle) {
            const {left, top, right, bottom} = cropRectangle;
            const context = savingCanvasRef.current.getContext('2d');
            if (!context) {
                throw new Error('Unable to get 2d context from canvas');
            }
            const width = right - left;
            const height = bottom - top;
            const unzoomedWidth = width / zoomFactor;
            const unzoomedHeight = height / zoomFactor;
            savingCanvasRef.current.width = savingCanvasRotation % 2 === 0 ? unzoomedWidth : unzoomedHeight;
            savingCanvasRef.current.height = savingCanvasRotation % 2 === 0 ? unzoomedHeight : unzoomedWidth;
            context.translate(savingCanvasRef.current.width / 2, savingCanvasRef.current.height / 2);
            context.rotate(savingCanvasRotation * Math.PI / 2);
            context.clearRect(0, 0, savingCanvasRef.current.width, savingCanvasRef.current.height);
            context.drawImage(pdfCanvasRef.current, left, top, width, height,
                -unzoomedWidth / 2, -unzoomedHeight / 2, unzoomedWidth, unzoomedHeight);
        }
    }, [cropRectangle, savingCanvasRotation, zoomFactor]);

    useEffect(() => {
        if (prepareSaveCrop && cropPoints && !savingCrop && !browseSavePath) {
            updateSavingCanvas();
        }
    }, [browseSavePath, cropPoints, prepareSaveCrop, savingCrop, updateSavingCanvas]);

    const getCropSavePath = useCallback(() => {
        const folderStack = folderStacks[(isSavingMap) ? FOLDER_MAP : FOLDER_MINI];
        const folderNames = folderStack.map((fileId) => (files.fileMetadata[fileId].name));
        return folderNames.join(' \u232A ');
    }, [files.fileMetadata, folderStacks, isSavingMap]);

    const saveCroppedMapOrMini = useCallback(async () => {
        setSavingCrop(true);
        updateSavingCanvas();
        const folderStack = folderStacks[(isSavingMap) ? FOLDER_MAP : FOLDER_MINI];
        const parents = folderStack.slice(folderStack.length - 1, folderStack.length);
        const file = await new Promise<Blob>((resolve, reject) => {
            savingCanvasRef.current?.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject('Failed to get blob from savingCanvas');
                }
            });
        });
        const newMetadata = await fileAPI.uploadFile({name: 'Crop from ' + metadata.name, parents}, file);
        // Add properties to the metadata after saving, so it's not saved with incomplete properties, but
        // the details are available in the editor.
        const {top, left} = cropRectangle!;
        setEditCrop({
            ...newMetadata,
            properties: {
                pageCrop: {
                    pdfMetadataId: metadata.id,
                    page: currentPage,
                    rotation: savingCanvasRotation * 90,
                    top: Math.round(top / zoomFactor),
                    left: Math.round(left / zoomFactor)
                }
            }
        });
        setSavingCrop(false);
        setPrepareSaveCrop(false);
        setCropPoints(undefined);
    }, [cropRectangle, currentPage, fileAPI, folderStacks, isSavingMap, metadata.id, metadata.name, savingCanvasRotation, updateSavingCanvas, zoomFactor]);

    const contentOrder = contentConfig?.getOrder();
    
    return saving ? (
        <div>
            Saving...
        </div>
    ) : (
        <RenameFileEditor
            className='pdfEditor'
            metadata={metadata}
            onClose={onClose}
            onSave={onPdfSave}
            hideControls={prepareSaveCrop || editCrop !== undefined}
            controls={!cropPoints || adjustingCropRectangle !== CropAdjustment.NONE || prepareSaveCrop ? undefined :
                [
                    <InputButton key='cancelButton' type='button' onChange={() => {
                        setCropPoints(undefined);
                    }}>Cancel Selection</InputButton>,
                    <InputButton key='miniButton' type='button' onChange={() => {
                        setPrepareSaveCrop(true);
                        setIsSavingMap(false);
                        setSavingCanvasRotation(0);
                    }}>Save new miniature</InputButton>,
                    <InputButton key='mapButton' type='button' onChange={() => {
                        setPrepareSaveCrop(true);
                        setIsSavingMap(true);
                        setSavingCanvasRotation(0);
                    }}>Save new map</InputButton>
                ]
            }
        >
            {
                prepareSaveCrop && cropPoints ? (
                    savingCrop ? (
                        <div>
                            Saving cropped image to {getCropSavePath()}...
                        </div>
                    ) : browseSavePath ? (
                        <BrowseFilesComponent topDirectory={isSavingMap ? constants.FOLDER_MAP : constants.FOLDER_MINI}
                                              fileActions={[]}
                                              editorComponent={MiniEditor}
                                              allowMultiPick={false}
                                              allowUploadAndWebLink={false}
                                              showSearch={true}
                                              onBack={() => {setBrowseSavePath(false)}}
                        />
                    ) : (
                        <div className='savingCrop'>
                            <p>
                                <b>Save to: </b> {getCropSavePath()}
                                <InputButton type='button' onChange={() => {setBrowseSavePath(true)}}>...</InputButton>
                            </p>
                            <InputButton type='button' onChange={saveCroppedMapOrMini}>Save</InputButton>
                            <InputButton type='button' onChange={() => {
                                setPrepareSaveCrop(false);
                            }}>Cancel</InputButton>
                            <div className='rotateButtons'>
                                <InputButton type='button' className='material-icons' onChange={() => {
                                    setSavingCanvasRotation((prev) => ((prev - 1) % 4));
                                }}>rotate_left</InputButton>
                                <InputButton type='button' className='material-icons' onChange={() => {
                                    setSavingCanvasRotation((prev) => ((prev + 1) % 4));
                                }}>rotate_right</InputButton>
                            </div>
                            <canvas ref={savingCanvasRef}/>
                        </div>
                    )
                ) : editCrop ? (
                    isSavingMap ? (
                        <MapEditor metadata={editCrop as FileMetadata<void, MapProperties>}
                                   onClose={() => {
                                       setEditCrop(undefined);
                                   }}
                        />
                    )  : (
                        <MiniEditor metadata={editCrop as FileMetadata<void, MiniProperties>}
                                    onClose={() => {
                                        setEditCrop(undefined);
                                    }}
                        />
                    )
                ) : numPages ? (
                    <div>
                        <div className='pageControls'>
                            <InputButton type='button' className='material-icons' disabled={currentPage < 2} onChange={() => {
                                updateCurrentPage(1);
                            }}>first_page</InputButton>
                            <InputButton type='button' className='material-icons' disabled={currentPage < 2} onChange={() => {
                                updateCurrentPage(currentPage - 1);
                            }}>chevron_left</InputButton>
                            <InputField type='number' value={currentPage}
                                        style={{width: `${Math.ceil(2 + Math.log10(numPages) / 2)}em`}}
                                        onChange={setCurrentPage} // Don't refresh until onBlur.
                                        onBlur={updateCurrentPage}
                                        specialKeys={{Enter: confirmCurrentPage, Return: confirmCurrentPage}}
                            />
                            <span>/&nbsp;{numPages}</span>
                            <InputButton type='button' className='material-icons' disabled={currentPage >= numPages} onChange={() => {
                                updateCurrentPage(currentPage + 1);
                            }}>chevron_right</InputButton>
                            <InputButton type='button' className='material-icons' disabled={currentPage >= numPages} onChange={() => {
                                updateCurrentPage(numPages);
                            }}>last_page</InputButton>
                        </div>
                        <div className='zoomControls'>
                            <InputButton type='button' className='zoomButton material-icons' onChange={() => {
                                adjustZoomFactor(0.9);
                            }} tooltip='Zoom out'>zoom_out</InputButton>
                            <InputButton type='button' className='zoomButton material-icons' onChange={() => {
                                adjustZoomFactor(1 / zoomFactor);
                            }} disabled={Math.abs(zoomFactor - 1) < 0.01} tooltip='Reset zoom to 100%'>filter_1</InputButton>
                            <InputButton type='button' className='zoomButton material-icons' onChange={() => {
                                adjustZoomFactor(1 / 0.9);
                            }} tooltip='Zoom in'>zoom_in</InputButton>
                            <InputButton type='button' className='zoomButton material-icons' onChange={() => {
                                if (pdfPanelSize.width !== undefined && pdfPanelSize.height !== undefined) {
                                    const canvas = pdfCanvasRef.current!;
                                    const zoomFactor = Math.min(
                                        (pdfPanelSize.width - 2*PDF_WRAPPER_MARGIN) / canvas.width,
                                        (pdfPanelSize.height - 2*PDF_WRAPPER_MARGIN) / canvas.height
                                    );
                                    adjustZoomFactor(zoomFactor);
                                }
                            }} tooltip='Zoom to fit page'>aspect_ratio</InputButton>
                        </div>
                    </div>
                ) : (
                    <div>
                        Loading...
                    </div>
                )
            }
            <div className='pdfEditorContent'>
                {
                    (!contentOrder || prepareSaveCrop || editCrop !== undefined) ? null : (
                        <div className='layerPanel'>
                            <b>Layers</b>
                            {
                                contentOrder.map((groupName: string) => {
                                    const group = contentConfig?.getGroup(groupName);
                                    return (
                                        !group ? null : (
                                            <div key={groupName}>
                                                <InputField type='checkbox' value={group.visible} onChange={(visible) => {
                                                    contentConfig?.setVisibility(groupName, visible);
                                                }} heading={group.name} />
                                            </div>
                                        )
                                    )
                                })
                            }
                        </div>
                    )
                }
                <GestureControls
                    className='pdfCanvasGestureControls'
                    defaultHandler={gestureHandler}
                    offsetX={PDF_WRAPPER_MARGIN}
                    offsetY={PDF_WRAPPER_MARGIN}
                    ref={canvasWrapperRef}
                >
                    <ReactResizeDetector handleWidth={true} handleHeight={true} onResize={onResize}/>
                    <PdfViewer metadata={metadata}
                               className={prepareSaveCrop || editCrop !== undefined ? 'hidden' : undefined}
                               style={getCropAdjustmentStyle(adjustingCropRectangle)}
                               onPdfLoaded={onPdfLoaded}
                               pageNumber={currentPage}
                               zoomFactor={zoomFactor}
                               onCanvasSizeChanged={setPdfCanvasSize}
                               ref={pdfCanvasRef}
                    >
                        {
                            !cropPoints ? null : (
                                <div className='cropMask' style={cropStyle}/>
                            )
                        }
                    </PdfViewer>
                </GestureControls>
            </div>
        </RenameFileEditor>
    );
};

export default PdfFileEditor;

function isPointWithinBounds(x: number, y: number, left: number, top: number, right: number, bottom: number) {
    return x <= right && x >= left && y <= bottom && y >= top;
}

function getCropAdjustmentStyle(cropAdjustment: CropAdjustment): CSSProperties {
    switch(cropAdjustment) {
        case CropAdjustment.POSITIONING: return {cursor: 'move'};
        case CropAdjustment.RESIZING: return {cursor: 'crosshair'};
        case CropAdjustment.RESIZING_HORZ: return {cursor: 'ew-resize'};
        case CropAdjustment.RESIZING_VERT: return {cursor: 'ns-resize'}
        default: return {cursor: 'unset'};
    }
}
