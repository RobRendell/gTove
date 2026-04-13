import './pdfFileEditor.scss';

import classNames from 'classnames';
import {useGranularEffect} from 'granular-hooks';
import clamp from 'lodash/clamp';
import {getDocument, GlobalWorkerOptions, PDFDocumentProxy} from 'pdfjs-dist';
import PdfJsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import {OptionalContentConfig} from 'pdfjs-dist/types/src/display/optional_content_config';
import {CSSProperties, FunctionComponent, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {useSelector} from 'react-redux';
import ReactResizeDetector from 'react-resize-detector';

import BrowseFilesComponent from '../container/browseFilesComponent';
import GestureControls, {GestureHandler} from '../container/gestureControls';
import InputField from '../container/inputField';
import {FileAPIContextObject} from '../context/fileAPIProvider';
import {PromiseModalContextObject} from '../context/promiseModalProvider';
import {getAllFilesFromStore, getFolderStacksFromStore} from '../redux/mainReducer';
import * as constants from '../util/constants';
import {FOLDER_MAP, FOLDER_MINI} from '../util/constants';
import {ObjectVector2} from '../util/scenarioUtils';
import {FileMetadata, MapProperties, MiniProperties} from '../util/storage/storageContract';
import InputButton from './inputButton';
import MapEditor from './mapEditor';
import MiniEditor from './miniEditor';
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

/**
 * The margin (in pixels) of the PDF wrapper div
 */
const PDF_WRAPPER_MARGIN = 20;

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
    const promiseModal = useContext(PromiseModalContextObject);
    const folderStacks = useSelector(getFolderStacksFromStore);
    const files = useSelector(getAllFilesFromStore);

    const pageCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const canvasWrapperRef = useRef<HTMLDivElement | null>(null);
    const savingCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const refreshingRef = useRef(false);

    const [browseSavePath, setBrowseSavePath] = useState(false);
    const [, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [numPages, setNumPages] = useState(0);
    const [zoomFactor, setZoomFactor] = useState(1);
    const [adjustingCropRectangle, setAdjustingCropRectangle] = useState(CropAdjustment.NONE);
    const [prepareSaveCrop, setPrepareSaveCrop] = useState(false);
    const [savingCrop, setSavingCrop] = useState(false);
    const [isSavingMap, setIsSavingMap] = useState(false);
    const [savingCanvasRotation, setSavingCanvasRotation] = useState(0);
    const [pdfProxy, setPdfProxy] = useState<PDFDocumentProxy | undefined>();
    const [loadError, setLoadError] = useState<string | undefined>();
    const [pageError, setPageError] = useState<string | undefined>();
    const [pdfPanelSize, setPdfPanelSize] = useState<{width?: number; height?: number}>({});
    const [pdfCanvasSize, setPdfCanvasSize] = useState({width: 0, height: 0});
    const [cropRectangle, setCropRectangle] = useState<ObjectVector2[] | undefined>();
    const [editCrop, setEditCrop] = useState<FileMetadata | undefined>();
    const [contentConfig, setContentConfig] = useState<OptionalContentConfig | undefined>();

    const onResize = useCallback((width?: number, height?: number) => {
        setPdfPanelSize({width, height});
    }, []);

    const requestPassword = useCallback(async (setPassword: (password: string) => void, reason: number) => {
        if (promiseModal?.isAvailable()) {
            const okResponse = 'Ok';
            let password = '';
            const response = await promiseModal({
                children: (
                    <div>
                        <p>{reason === 1 ? 'This PDF requires a password to open.' : 'The password given was incorrect.'}</p>
                        <input type='password' placeholder='Enter password' onChange={(event) => {password = event.target.value}}/>
                    </div>
                ),
                options: [okResponse, 'Cancel']
            });
            if (response === okResponse) {
                setPassword(password);
                return;
            }
        }
        onClose();
    }, [onClose, promiseModal]);

    useEffect(() => {
        // Re-render the PDF page when any of a number of props change.
        (async () => {
            const canvas = pageCanvasRef.current;
            if (!refreshingRef.current && canvas && pdfProxy && currentPage > 0 && currentPage <= numPages) {
                // We need refreshing to be both a synchronous variable (so we don't do overlapping renders) and a state
                // variable (so the page re-renders when the refresh finishes).
                refreshingRef.current = true;
                setRefreshing(true);
                const canvasContext = canvas.getContext('2d');
                if (!canvasContext) {
                    throw new Error('Failed to get 2D context from canvas');
                }
                try {
                    const page = await pdfProxy.getPage(currentPage);
                    const viewport = page.getViewport({scale: zoomFactor});
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    await page.render({
                        canvas, canvasContext, viewport,
                        ...(contentConfig === undefined ? undefined : {optionalContentConfigPromise: Promise.resolve(contentConfig)})
                    }).promise;
                    refreshingRef.current = false;
                    setPdfCanvasSize({width: canvas.width, height: canvas.height});
                    setRefreshing(false);
                } catch (e: any) {
                    console.error(`Refreshing page ${currentPage} threw exception:`, e);
                    setPageError(e.message);
                }
            }
        })();
    }, [contentConfig, currentPage, numPages, pdfProxy, savingCanvasRotation, zoomFactor]);

    const updateCurrentPage = useCallback(async (currentPage: number) => {
        if (currentPage < 1) {
            currentPage = 1;
        } else if (currentPage > numPages) {
            currentPage = numPages;
        }
        setCurrentPage(currentPage);
        setContentConfig(await pdfProxy?.getOptionalContentConfig());
    }, [numPages, pdfProxy]);

    const confirmCurrentPage = useCallback(() => {
        void updateCurrentPage(currentPage);
    }, [currentPage, updateCurrentPage]);

    const onPdfSave = useCallback(async (saveMetadata: FileMetadata<void, void>) => {
        setSaving(true);
        await onSave?.(saveMetadata);
        setSaving(false);
    }, [onSave]);

    const getCropRectangle = useCallback(() => {
        if (cropRectangle) {
            const left = Math.min(cropRectangle[0].x, cropRectangle[1].x);
            const right = Math.max(cropRectangle[0].x, cropRectangle[1].x);
            const top = Math.min(cropRectangle[0].y, cropRectangle[1].y);
            const bottom = Math.max(cropRectangle[0].y, cropRectangle[1].y);
            return {left, top, right, bottom};
        } else {
            return undefined;
        }
    }, [cropRectangle]);
    
    const adjustZoomFactor = useCallback((adjust: number) => {
        setZoomFactor((zoomFactor) => {
            const newZoomFactor = adjust * zoomFactor;
            // Keep scrolled window centred.
            if (canvasWrapperRef.current && pageCanvasRef.current) {
                const {scrollTop, scrollLeft, clientWidth: wrapperWidth, clientHeight: wrapperHeight} = canvasWrapperRef.current;
                const {width, height} = pageCanvasRef.current;
                const halfWidth = Math.min(wrapperWidth, width) / 2;
                const halfHeight = Math.min(wrapperHeight, height) / 2;
                canvasWrapperRef.current.scrollTop = (scrollTop + halfHeight) * newZoomFactor / zoomFactor - halfHeight;
                canvasWrapperRef.current.scrollLeft = (scrollLeft + halfWidth) * newZoomFactor / zoomFactor - halfWidth;
            }
            // Also adjust cropRectangle if it's set
            setCropRectangle((cropRectangle) => (
                (cropRectangle === undefined) ? undefined : cropRectangle.map((point) => ({
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
        const rectangle = getCropRectangle();
        const canvas = pageCanvasRef.current!;
        if (!isPointWithinBounds(startPos.x, startPos.y, 0, 0, canvas.width, canvas.height)) {
            return;
        }
        if (rectangle) {
            const {left, top, right, bottom} = rectangle;
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
                        setCropRectangle([{x, y}, startPos]);
                    } else {
                        setAdjustingCropRectangle(CropAdjustment.RESIZING_HORZ);
                        setCropRectangle([{x, y}, {x: startPos.x, y: bottom + top - y}]);
                    }
                } else if (startY <= top + margin || startY >= bottom - margin) {
                    setAdjustingCropRectangle(CropAdjustment.RESIZING_VERT);
                    setCropRectangle([{x, y}, {x: left + right - x, y: startPos.y}]);
                } else {
                    setAdjustingCropRectangle(CropAdjustment.RESIZING);
                    setCropRectangle([{x, y}, startPos]);
                }
            } else {
                // Reposition time!
                setAdjustingCropRectangle(CropAdjustment.POSITIONING);
                setCropRectangle([{x: left, y: top}, {x: right, y: bottom}, startPos]);
            }
        } else {
            setAdjustingCropRectangle(CropAdjustment.RESIZING);
            setCropRectangle([startPos, startPos]);
        }
    }, [getCropRectangle]);
    const onPan = useCallback((_delta: ObjectVector2, position: ObjectVector2) => {
        if (adjustingCropRectangle === CropAdjustment.NONE) {
            return;
        }
        // We are adjusting crop rectangles.
        const canvas = pageCanvasRef.current!;
        const maxWidth = canvas.width - 1;
        const maxHeight = canvas.height - 1;
        setCropRectangle((cropRectangle) => {
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

    const {wrapperStyle, cropStyle} = useMemo(() => {
        if (prepareSaveCrop || editCrop !== undefined) {
            return {wrapperStyle: {height: '0', margin: PDF_WRAPPER_MARGIN}, cropStyle: undefined};
        } else if (!pageCanvasRef.current) {
            return {wrapperStyle: {width: '100%', height: '100%', margin: PDF_WRAPPER_MARGIN}, cropStyle: undefined};
        }
        const rectangle = getCropRectangle();
        const {width, height} = pdfCanvasSize;
        const wrapperStyle: CSSProperties = {
            width,
            height,
            cursor: rectangle ? getCropAdjustmentCursor(adjustingCropRectangle) : 'unset',
            margin: PDF_WRAPPER_MARGIN
        };
        const cropStyle = rectangle ? {
            left: rectangle.left,
            top: rectangle.top,
            right: width - rectangle.right,
            bottom: height - rectangle.bottom
        } : undefined;
        return {wrapperStyle, cropStyle};
    }, [adjustingCropRectangle, editCrop, getCropRectangle, pdfCanvasSize, prepareSaveCrop]);
    
    const updateSavingCanvas = useCallback(() => {
        if (savingCanvasRef.current && pageCanvasRef.current) {
            const {left, top, right, bottom} = getCropRectangle()!;
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
            context.drawImage(pageCanvasRef.current, left, top, width, height,
                -unzoomedWidth / 2, -unzoomedHeight / 2, unzoomedWidth, unzoomedHeight);
        }
    }, [getCropRectangle, savingCanvasRotation, zoomFactor]);

    const getCropSavePath = useCallback(() => {
        const folderStack = folderStacks[(isSavingMap) ? FOLDER_MAP : FOLDER_MINI];
        const folderNames = folderStack.map((fileId) => (files.fileMetadata[fileId].name));
        return folderNames.join(' \u232A ');
    }, [files.fileMetadata, folderStacks, isSavingMap]);

    useGranularEffect(() => {
        (async () => {
            const pdfBlob = await fileAPI.getFileContents(metadata);
            const data = await pdfBlob.arrayBuffer();
            const document = getDocument(new Uint8Array(data));
            (document as any).onPassword = requestPassword;
            try {
                const pdfProxy = await document.promise;
                setPdfProxy(pdfProxy);
                setNumPages(pdfProxy.numPages);
                setContentConfig(await pdfProxy.getOptionalContentConfig());
            } catch (e: any) {
                console.error(`Error loading PDF ${metadata.name}:`, e);
                setLoadError(e.message);
            }
        })();
    }, [], [fileAPI, metadata, requestPassword]);

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
            controls={!cropRectangle || adjustingCropRectangle !== CropAdjustment.NONE || prepareSaveCrop ? undefined :
                [
                    <InputButton key='cancelButton' type='button' onChange={() => {
                        setCropRectangle(undefined);
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
                loadError ? (
                    <div>
                        There was an error loading the PDF: {loadError}
                    </div>
                ) : prepareSaveCrop && cropRectangle ? (
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
                            <InputButton type='button' onChange={async () => {
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
                                const {top, left} = getCropRectangle()!;
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
                                setCropRectangle(undefined);
                            }}>Save</InputButton>
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
                            <canvas ref={(canvas) => {
                                savingCanvasRef.current = canvas;
                                updateSavingCanvas();
                            }}/>
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
                ) : pdfProxy ? (
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
                                    const canvas = pageCanvasRef.current!;
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
                    <div className={classNames('canvasWrapper', {
                        hidden: prepareSaveCrop || editCrop !== undefined
                    })} style={wrapperStyle}>
                        <canvas ref={pageCanvasRef}/>
                        {
                            !cropRectangle ? null : (
                                <div className='cropMask' style={cropStyle}/>
                            )
                        }
                    </div>
                    {
                        !pageError ? null : (
                            <div>
                                Error loading page: {pageError}
                            </div>
                        )
                    }
                </GestureControls>
            </div>
        </RenameFileEditor>
    );
};

export default PdfFileEditor;

function isPointWithinBounds(x: number, y: number, left: number, top: number, right: number, bottom: number) {
    return x <= right && x >= left && y <= bottom && y >= top;
}

function getCropAdjustmentCursor(cropAdjustment: CropAdjustment) {
    switch(cropAdjustment) {
        case CropAdjustment.POSITIONING: return 'move';
        case CropAdjustment.RESIZING: return 'crosshair';
        case CropAdjustment.RESIZING_HORZ: return 'ew-resize';
        case CropAdjustment.RESIZING_VERT: return 'ns-resize'
        default: return 'unset';
    }
}
