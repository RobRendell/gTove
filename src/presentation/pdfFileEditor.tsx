import {Component, createRef} from 'react';
import {Store} from 'redux';
import * as PropTypes from 'prop-types';
import {getDocument, GlobalWorkerOptions} from 'pdfjs-dist/legacy/build/pdf';
import classNames from 'classnames';
import {clamp} from 'lodash';
import ReactResizeDetector from 'react-resize-detector';
import {PDFDocumentProxy} from 'pdfjs-dist/types/display/api';
// @ts-ignore
// eslint-disable-next-line import/no-webpack-loader-syntax
import PdfJsWorker from 'worker-loader!pdfjs-dist/build/pdf.worker.js';

import './pdfFileEditor.scss';

import {GtoveDispatchProp, ReduxStoreType} from '../redux/mainReducer';
import RenameFileEditor from './renameFileEditor';
import {FileMetadata, MapProperties, MiniProperties} from '../util/storage/storageContract';
import {FileAPIContext} from '../util/storage/storageContract';
import InputButton from './inputButton';
import InputField from './inputField';
import {PromiseModalContext} from '../context/promiseModalContextBridge';
import GestureControls from '../container/gestureControls';
import {ObjectVector2} from '../util/scenarioUtils';
import {FileIndexReducerType} from '../redux/fileIndexReducer';
import MiniEditor from './miniEditor';
import MapEditor from './mapEditor';
import DriveTextureLoader from '../util/storage/providers/google/driveTextureLoader';
import {OptionalContentConfig} from 'pdfjs-dist/types/display/optional_content_config';
import BrowseFilesComponent from '../container/browseFilesComponent';
import * as constants from '../util/constants';
import {UploadPlaceholderReducerType} from '../redux/uploadPlaceholderReducer';

interface PdfFileEditorProps extends GtoveDispatchProp {
    store: Store<ReduxStoreType>;
    metadata: FileMetadata<void, void>;
    onClose: () => void;
    onSave?: (metadata: FileMetadata<void, void>) => Promise<any>;
    getSaveMetadata: () => Partial<FileMetadata<void, void>>;
    className?: string;
    textureLoader: DriveTextureLoader;
    miniFolderStack: string[];
    mapFolderStack: string[];
    uploadPlaceholders: UploadPlaceholderReducerType;
    files: FileIndexReducerType;
}

interface PdfFileEditorState {
    browseSavePath: boolean;
    refreshing: boolean;
    saving: boolean;
    currentPage: number;
    numPages: number;
    pdfProxy?: PDFDocumentProxy;
    loadError?: string;
    pageError?: string;
    zoomFactor: number;
    pdfPanelWidth?: number;
    pdfPanelHeight?: number;
    cropRectangle?: ObjectVector2[];
    adjustingCropRectangle: CropAdjustment;
    prepareSaveCrop: boolean;
    savingCrop: boolean;
    editCrop?: FileMetadata;
    isSavingMap: boolean;
    savingCanvasRotation: number;
    contentConfig?: OptionalContentConfig;
}

/** The max distance from the drag border to be considered for crop rect resizing. */
const CROP_ADJUSTMENT_DRAG_MARGIN = 32;

/**
 * The possible states for adjusting crop. Use {@link isCropAdjusting} to check if it is active.
 */
enum CropAdjustment {
    NONE = 0,
    RESIZING,
    RESIZING_HORZ,
    RESIZING_VERT,
    POSITIONING,
}

/**
 * Whether the crop adjustment state is considered actively used by the user.
 */
function isCropAdjusting(cropAdjustment: CropAdjustment) {
    return cropAdjustment !== CropAdjustment.NONE;
}

/**
 * Whether the given point at position is within the bounds.
 */
function isPointWithinBounds(x: number, y: number, left: number, top: number, right: number, bottom: number) {
    return x <= right && x >= left && y <= bottom && y >= top;
}

/**
 * Get the crop adjustment cursor style string for the target state.
 */
function getCropAdjustmentCursor(cropAdjustment: CropAdjustment) {
    switch(cropAdjustment) {
        case CropAdjustment.POSITIONING: return 'move';
        case CropAdjustment.RESIZING: return 'crosshair';
        case CropAdjustment.RESIZING_HORZ: return 'ew-resize';
        case CropAdjustment.RESIZING_VERT: return 'ns-resize'
        default: return 'unset';
    }
}

/**
 * The margin (in pixels) of the PDF wrapper div
 */
const PDF_WRAPPER_MARGIN = 20;

export default class PdfFileEditor extends Component<PdfFileEditorProps, PdfFileEditorState> {

    static contextTypes = {
        fileAPI: PropTypes.object,
        promiseModal: PropTypes.func
    };

    context: FileAPIContext & PromiseModalContext;

    private pageCanvasRef = createRef<HTMLCanvasElement>();
    private canvasWrapperRef = createRef<HTMLDivElement>();
    private savingCanvas: HTMLCanvasElement | null = null;

    private refreshing = false;

    constructor(props: PdfFileEditorProps) {
        super(props);
        this.onSave = this.onSave.bind(this);
        this.confirmCurrentPage = this.confirmCurrentPage.bind(this);
        this.updateCurrentPage = this.updateCurrentPage.bind(this);
        this.refreshPage = this.refreshPage.bind(this);
        this.requestPassword = this.requestPassword.bind(this);
        this.onGestureStart = this.onGestureStart.bind(this);
        this.onPan = this.onPan.bind(this);
        this.onZoom = this.onZoom.bind(this);
        this.onGestureEnd = this.onGestureEnd.bind(this);
        this.updateSavingCanvas = this.updateSavingCanvas.bind(this);
        this.onResize = this.onResize.bind(this);
        this.state = {
            browseSavePath: false,
            refreshing: false,
            saving: false,
            currentPage: 1,
            numPages: 0,
            zoomFactor: 1,
            adjustingCropRectangle: CropAdjustment.NONE,
            prepareSaveCrop: false,
            savingCrop: false,
            isSavingMap: false,
            savingCanvasRotation: 0
        };
        if (!(GlobalWorkerOptions as any).workerPort) {
            (GlobalWorkerOptions as any).workerPort = new PdfJsWorker();
        }
    }

    async componentDidMount() {
        const pdfBlob = await this.context.fileAPI.getFileContents(this.props.metadata);
        const data = await pdfBlob.arrayBuffer();
        const document = getDocument(new Uint8Array(data));
        (document as any).onPassword = this.requestPassword;
        try {
            const pdfProxy = await document.promise;
            this.setState({pdfProxy, numPages: pdfProxy.numPages}, this.refreshPage);
            const contentConfig = await pdfProxy.getOptionalContentConfig();
            this.setState({contentConfig});
        } catch (e: any) {
            console.error(`Error loading PDF ${this.props.metadata.name}:`, e);
            this.setState({loadError: e.message});
        }
    }

    onResize(pdfPanelWidth?: number, pdfPanelHeight?: number) {
        this.setState({pdfPanelWidth, pdfPanelHeight});
    }

    async requestPassword(setPassword: (password: string) => void, reason: number) {
        if (this.context.promiseModal?.isAvailable()) {
            const okResponse = 'Ok';
            let password = '';
            const response = await this.context.promiseModal({
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
        this.props.onClose();
    }

    confirmCurrentPage() {
        this.updateCurrentPage(this.state.currentPage);
    }

    updateCurrentPage(currentPage: number) {
        if (currentPage < 1) {
            currentPage = 1;
        } else if (currentPage > this.state.numPages) {
            currentPage = this.state.numPages;
        }
        this.setState({currentPage}, this.refreshPage);
        this.state.pdfProxy?.getOptionalContentConfig().then((contentConfig) => {
            this.setState({contentConfig});
        });
    }

    async refreshPage() {
        const {currentPage, pdfProxy} = this.state;
        const canvas = this.pageCanvasRef.current;
        if (!this.refreshing && canvas && pdfProxy && currentPage > 0 && currentPage <= this.state.numPages) {
            // We need refreshing to be both a synchronous variable (so we don't do overlapping renders) and a state
            // variable (so the page re-renders when the refresh finishes).
            this.refreshing = true;
            this.setState({refreshing: true});
            const canvasContext = canvas.getContext('2d');
            if (!canvasContext) {
                throw new Error('Failed to get 2D context from canvas');
            }
            try {
                const page = await pdfProxy.getPage(currentPage);
                const viewport = page.getViewport({scale: this.state.zoomFactor});
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await page.render({
                    canvasContext, viewport,
                    ...(this.state.contentConfig === undefined ? undefined : {optionalContentConfigPromise: Promise.resolve(this.state.contentConfig)})
                }).promise;
                this.refreshing = false;
                this.setState({refreshing: false});
                if (currentPage !== this.state.currentPage) {
                    // Page changed in the meantime.
                    await this.refreshPage();
                }
            } catch (e: any) {
                console.error(`Refreshing page ${currentPage} threw exception:`, e);
                this.setState({pageError: e.message});
            }
        }
    }

    async onSave(saveMetadata: FileMetadata<void, void>) {
        this.setState({saving: true});
        this.props.onSave && await this.props.onSave(saveMetadata);
        this.setState({saving: false});
    }

    getCropRectangle() {
        const cropRectangle = this.state.cropRectangle;
        if (cropRectangle) {
            const left = Math.min(cropRectangle[0].x, cropRectangle[1].x);
            const right = Math.max(cropRectangle[0].x, cropRectangle[1].x);
            const top = Math.min(cropRectangle[0].y, cropRectangle[1].y);
            const bottom = Math.max(cropRectangle[0].y, cropRectangle[1].y);
            return {left, top, right, bottom};
        } else {
            return undefined;
        }
    }

    onGestureStart(startPos: ObjectVector2) {
        if (this.savingCanvas) {
            return;
        }
        const rectangle = this.getCropRectangle();
        const canvas = this.pageCanvasRef.current!;
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
                        this.setState({adjustingCropRectangle: CropAdjustment.RESIZING, cropRectangle: [{x, y}, startPos]});
                    } else {
                        this.setState({adjustingCropRectangle: CropAdjustment.RESIZING_HORZ, cropRectangle: [{x, y}, {x: startPos.x, y: bottom + top - y}]});
                    }
                } else if (startY <= top + margin || startY >= bottom - margin) {
                    this.setState({adjustingCropRectangle: CropAdjustment.RESIZING_VERT, cropRectangle: [{x, y}, {x: left + right - x, y: startPos.y}]});
                } else {
                    this.setState({adjustingCropRectangle: CropAdjustment.RESIZING, cropRectangle: [{x, y}, startPos]});
                }

            } else {
                // Reposition time!
                let a = { x: left, y: top };
                let b = { x: right, y: bottom };
                this.setState({adjustingCropRectangle: CropAdjustment.POSITIONING, cropRectangle: [a, b, startPos]});
            }
        } else {
            this.setState({adjustingCropRectangle: CropAdjustment.RESIZING, cropRectangle: [startPos, startPos]});
        }
    }

    onPan(_delta: ObjectVector2, position: ObjectVector2) {
        const { adjustingCropRectangle, cropRectangle } = this.state;
        if (!isCropAdjusting(adjustingCropRectangle)) {
            return;
        } else if (!cropRectangle) {
            // Invalid state! This should never happen :(
            throw new Error('Crop is being adjusted but crop rectangle does not exist.');
        }
        // We are adjusting crop rectangles.
        const canvas = this.pageCanvasRef.current!;
        const maxWidth = canvas.width - 1;
        const maxHeight = canvas.height - 1;
        switch(adjustingCropRectangle) {
            case CropAdjustment.POSITIONING:
                const prev = cropRectangle[2];
                const deltaX = position.x - prev.x;
                const deltaY = position.y - prev.y;
                const a = cropRectangle[0];
                const b = cropRectangle[1];
                this.setState({
                    cropRectangle: [
                        { x: clamp(a.x + deltaX, 0, maxWidth), y: clamp(a.y + deltaY, 0, maxHeight) },
                        { x: clamp(b.x + deltaX, 0, maxWidth), y: clamp(b.y + deltaY, 0, maxHeight) },
                        position
                    ]
                });
                break;
            case CropAdjustment.RESIZING:
                this.setState({
                    cropRectangle: [cropRectangle[0], {x: clamp(position.x, 0, maxWidth), y: clamp(position.y, 0, maxHeight)}]
                });
                break;
            case CropAdjustment.RESIZING_HORZ:
                this.setState({
                    cropRectangle: [cropRectangle[0], {x: clamp(position.x, 0, maxWidth), y: cropRectangle[1].y}]
                });
                break;
            case CropAdjustment.RESIZING_VERT:
                this.setState({
                    cropRectangle: [cropRectangle[0], {x: cropRectangle[1].x, y: clamp(position.y, 0, maxHeight)}]
                });
                break;
            default:
                throw new Error(`Unknown crop adjustment state ${adjustingCropRectangle}.`);
        }
    }

    onZoom(delta: ObjectVector2) {
        if (delta.y !== 0) {
            this.adjustZoomFactor(delta.y < 0 ? 1.1 : 0.9);
        }
    }

    onGestureEnd() {
        this.setState({adjustingCropRectangle: CropAdjustment.NONE});
    }

    updateSavingCanvas() {
        if (this.savingCanvas && this.pageCanvasRef.current) {
            const {left, top, right, bottom} = this.getCropRectangle()!;
            const context = this.savingCanvas.getContext('2d');
            if (!context) {
                throw new Error('Unable to get 2d context from canvas');
            }
            const width = right - left;
            const height = bottom - top;
            const unzoomedWidth = width / this.state.zoomFactor;
            const unzoomedHeight = height / this.state.zoomFactor;
            this.savingCanvas.width = this.state.savingCanvasRotation % 2 === 0 ? unzoomedWidth : unzoomedHeight;
            this.savingCanvas.height = this.state.savingCanvasRotation % 2 === 0 ? unzoomedHeight : unzoomedWidth;
            context.translate(this.savingCanvas.width / 2, this.savingCanvas.height / 2);
            context.rotate(this.state.savingCanvasRotation * Math.PI / 2);
            context.clearRect(0, 0, this.savingCanvas.width, this.savingCanvas.height);
            context.drawImage(this.pageCanvasRef.current, left, top, width, height,
                -unzoomedWidth / 2, -unzoomedHeight / 2, unzoomedWidth, unzoomedHeight);
        }
    }

    getCropSavePath() {
        const folderStack = (this.state.isSavingMap) ? this.props.mapFolderStack : this.props.miniFolderStack;
        const folderNames = folderStack.map((fileId) => (this.props.files.fileMetadata[fileId].name));
        return folderNames.join(' \u232A ');
    }

    renderSavingCrop() {
        return this.state.savingCrop ? (
            <div>
                Saving cropped image to {this.getCropSavePath()}...
            </div>
        ) : this.state.browseSavePath ? (
            <BrowseFilesComponent topDirectory={this.state.isSavingMap ? constants.FOLDER_MAP : constants.FOLDER_MINI}
                                  fileActions={[]}
                                  editorComponent={MiniEditor}
                                  allowMultiPick={false}
                                  allowUploadAndWebLink={false}
                                  showSearch={true}
                                  onBack={() => {this.setState({browseSavePath: false})}}
            />
        ) : (
            <div className='savingCrop'>
                <p>
                    <b>Save to: </b> {this.getCropSavePath()}
                    <InputButton type='button' onChange={() => {this.setState({browseSavePath: true})}}>...</InputButton>
                </p>
                <InputButton type='button' onChange={async () => {
                    this.setState({savingCrop: true});
                    this.updateSavingCanvas();
                    const folderStack = (this.state.isSavingMap) ? this.props.mapFolderStack : this.props.miniFolderStack;
                    const parents = folderStack.slice(folderStack.length - 1, folderStack.length);
                    const file = await new Promise<Blob>((resolve, reject) => {
                        this.savingCanvas?.toBlob((blob) => {
                            if (blob) {
                                resolve(blob);
                            } else {
                                reject('Failed to get blob from savingCanvas');
                            }
                        });
                    });
                    const metadata = await this.context.fileAPI.uploadFile({name: 'Crop from ' + this.props.metadata.name, parents}, file);
                    // Add properties to the metadata after saving, so it's not saved with incomplete properties, but
                    // the details are available in the editor.
                    const {top, left} = this.getCropRectangle()!;
                    this.setState({editCrop: {
                            ...metadata,
                            properties: {
                                pageCrop: {
                                    pdfMetadataId: this.props.metadata.id,
                                    page: this.state.currentPage,
                                    rotation: this.state.savingCanvasRotation * 90,
                                    top: Math.round(top / this.state.zoomFactor),
                                    left: Math.round(left / this.state.zoomFactor)
                                }
                            }
                        }, savingCrop: false, prepareSaveCrop: false, cropRectangle: undefined});
                }}>Save</InputButton>
                <InputButton type='button' onChange={() => {
                    this.setState({prepareSaveCrop: false});
                }}>Cancel</InputButton>
                <div className='rotateButtons'>
                    <InputButton type='button' className='material-icons' onChange={() => {
                        this.setState(({savingCanvasRotation}) => ({savingCanvasRotation: (savingCanvasRotation - 1) % 4}),
                            this.updateSavingCanvas);
                    }}>rotate_left</InputButton>
                    <InputButton type='button' className='material-icons' onChange={() => {
                        this.setState(({savingCanvasRotation}) => ({savingCanvasRotation: (savingCanvasRotation + 1) % 4}),
                            this.updateSavingCanvas);
                    }}>rotate_right</InputButton>
                </div>
                <canvas ref={(canvas) => {
                    this.savingCanvas = canvas;
                    this.updateSavingCanvas();
                }}/>
            </div>
        );
    }

    calculateStyles() {
        if (this.state.prepareSaveCrop || this.state.editCrop !== undefined) {
            return {wrapperStyle: {height: '0', margin: PDF_WRAPPER_MARGIN}, cropStyle: undefined};
        } else if (!this.pageCanvasRef.current) {
            return {wrapperStyle: {width: '100%', height: '100%', margin: PDF_WRAPPER_MARGIN}, cropStyle: undefined};
        }
        const rectangle = this.getCropRectangle();
        const {width, height} = this.pageCanvasRef.current;
        const wrapperStyle: React.CSSProperties = {
            width,
            height,
            cursor: rectangle ? getCropAdjustmentCursor(this.state.adjustingCropRectangle) : 'unset',
            margin: PDF_WRAPPER_MARGIN
        };
        const cropStyle = rectangle ? {
            left: rectangle.left,
            top: rectangle.top,
            right: width - rectangle.right,
            bottom: height - rectangle.bottom
        } : undefined;
        return {wrapperStyle, cropStyle};
    }

    adjustZoomFactor(adjust: number) {
        this.setState(({zoomFactor, cropRectangle}) => {
            const newZoomFactor = adjust * zoomFactor;
            // Keep scrolled window centred.
            if (this.canvasWrapperRef.current && this.pageCanvasRef.current) {
                const {scrollTop, scrollLeft, clientWidth: wrapperWidth, clientHeight: wrapperHeight} = this.canvasWrapperRef.current;
                const {width, height} = this.pageCanvasRef.current;
                const halfWidth = Math.min(wrapperWidth, width) / 2;
                const halfHeight = Math.min(wrapperHeight, height) / 2;
                this.canvasWrapperRef.current.scrollTop = (scrollTop + halfHeight) * newZoomFactor / this.state.zoomFactor - halfHeight;
                this.canvasWrapperRef.current.scrollLeft = (scrollLeft + halfWidth) * newZoomFactor / this.state.zoomFactor - halfWidth;
            }
            // Also adjust cropRectangle if it's set
            const newCropRectangle = (cropRectangle === undefined) ? undefined : cropRectangle.map((point) => ({
                x: point.x / zoomFactor * newZoomFactor,
                y: point.y / zoomFactor * newZoomFactor
            }));
            return {zoomFactor: newZoomFactor, cropRectangle: newCropRectangle};
        }, () => {
            this.refreshPage();
        });
    }

    render() {
        const {wrapperStyle, cropStyle} = this.calculateStyles();
        const contentGroups = this.state.contentConfig?.getGroups();
        const contentOrder = this.state.contentConfig?.getOrder();
        return this.state.saving ? (
            <div>
                Saving...
            </div>
        ) : (
            <RenameFileEditor
                className='pdfEditor'
                metadata={this.props.metadata}
                onClose={this.props.onClose}
                getSaveMetadata={this.props.getSaveMetadata}
                onSave={this.onSave}
                hideControls={this.state.prepareSaveCrop || this.state.editCrop !== undefined}
                controls={!this.state.cropRectangle || isCropAdjusting(this.state.adjustingCropRectangle) || this.state.prepareSaveCrop ? undefined :
                    [
                        <InputButton key='cancelButton' type='button' onChange={() => {
                            this.setState({cropRectangle: undefined});
                        }}>Cancel Selection</InputButton>,
                        <InputButton key='miniButton' type='button' onChange={() => {
                            this.setState({prepareSaveCrop: true, isSavingMap: false, savingCanvasRotation: 0});
                        }}>Save new miniature</InputButton>,
                        <InputButton key='mapButton' type='button' onChange={() => {
                            this.setState({prepareSaveCrop: true, isSavingMap: true, savingCanvasRotation: 0});
                        }}>Save new map</InputButton>
                    ]
                }
            >
                {
                    this.state.loadError ? (
                        <div>
                            There was an error loading the PDF: {this.state.loadError}
                        </div>
                    ) : this.state.prepareSaveCrop && this.state.cropRectangle ? (
                        this.renderSavingCrop()
                    ) : this.state.editCrop ? (
                        this.state.isSavingMap ? (
                            <MapEditor metadata={this.state.editCrop as FileMetadata<void, MapProperties>}
                                       onClose={() => {
                                           this.setState({editCrop: undefined});
                                       }}
                                       textureLoader={this.props.textureLoader}
                            />
                        )  : (
                            <MiniEditor metadata={this.state.editCrop as FileMetadata<void, MiniProperties>}
                                        onClose={() => {
                                            this.setState({editCrop: undefined});
                                        }}
                                        textureLoader={this.props.textureLoader}
                            />
                        )
                    ) : this.state.pdfProxy ? (
                        <div>
                            <div className='pageControls'>
                                <InputButton type='button' className='material-icons' disabled={this.state.currentPage < 2} onChange={() => {
                                    this.updateCurrentPage(1);
                                }}>first_page</InputButton>
                                <InputButton type='button' className='material-icons' disabled={this.state.currentPage < 2} onChange={() => {
                                    this.updateCurrentPage(this.state.currentPage - 1);
                                }}>chevron_left</InputButton>
                                <InputField type='number' value={this.state.currentPage}
                                            style={{width: `${Math.ceil(2 + Math.log10(this.state.numPages) / 2)}em`}}
                                            onChange={(currentPage) => {
                                                this.setState({currentPage}); // Don't refresh until onBlur.
                                            }}
                                            onBlur={this.updateCurrentPage}
                                            specialKeys={{Enter: this.confirmCurrentPage, Return: this.confirmCurrentPage}}
                                />
                                <span>/&nbsp;{this.state.numPages}</span>
                                <InputButton type='button' className='material-icons' disabled={this.state.currentPage >= this.state.numPages} onChange={() => {
                                    this.updateCurrentPage(this.state.currentPage + 1);
                                }}>chevron_right</InputButton>
                                <InputButton type='button' className='material-icons' disabled={this.state.currentPage >= this.state.numPages} onChange={() => {
                                    this.updateCurrentPage(this.state.numPages);
                                }}>last_page</InputButton>
                            </div>
                            <div className='zoomControls'>
                                <InputButton type='button' className='zoomButton material-icons' onChange={() => {
                                    this.adjustZoomFactor(0.9);
                                }}>zoom_out</InputButton>
                                <InputButton type='button' className='zoomButton material-icons' onChange={() => {
                                    this.adjustZoomFactor(1 / this.state.zoomFactor);
                                }} disabled={Math.abs(this.state.zoomFactor - 1) < 0.01}>filter_1</InputButton>
                                <InputButton type='button' className='zoomButton material-icons' onChange={() => {
                                    this.adjustZoomFactor(1 / 0.9);
                                }}>zoom_in</InputButton>
                                <InputButton type='button' className='zoomButton material-icons' onChange={() => {
                                    if (this.state.pdfPanelWidth !== undefined && this.state.pdfPanelHeight !== undefined) {
                                        const canvas = this.pageCanvasRef.current!;
                                        const zoomFactor = Math.min(
                                            (this.state.pdfPanelWidth - 2*PDF_WRAPPER_MARGIN) / canvas.width,
                                            (this.state.pdfPanelHeight - 2*PDF_WRAPPER_MARGIN) / canvas.height
                                        );
                                        this.adjustZoomFactor(zoomFactor);
                                    }
                                }}>aspect_ratio</InputButton>
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
                            (!contentOrder || !contentGroups || this.state.prepareSaveCrop || this.state.editCrop !== undefined) ? null : (
                                <div className='layerPanel'>
                                    <b>Layers</b>
                                    {
                                        contentOrder.map((groupName: string) => (
                                            !contentGroups[groupName] ? null : (
                                                <div key={groupName}>
                                                    <InputField type='checkbox' value={contentGroups[groupName].visible} onChange={async (visible) => {
                                                        this.state.contentConfig?.setVisibility(groupName, visible);
                                                        return this.refreshPage();
                                                    }} heading={contentGroups[groupName].name} />
                                                </div>
                                            )
                                        ))
                                    }
                                </div>
                            )
                        }
                    <GestureControls
                        className='pdfCanvasGestureControls'
                        onGestureStart={this.onGestureStart}
                        onPan={this.onPan}
                        onZoom={this.onZoom}
                        onGestureEnd={this.onGestureEnd}
                        offsetX={PDF_WRAPPER_MARGIN}
                        offsetY={PDF_WRAPPER_MARGIN}
                        forwardRef={this.canvasWrapperRef}
                    >
                        <ReactResizeDetector handleWidth={true} handleHeight={true} onResize={this.onResize}/>
                        <div className={classNames('canvasWrapper', {
                            hidden: this.state.prepareSaveCrop || this.state.editCrop !== undefined
                        })} style={wrapperStyle}>
                            <canvas ref={this.pageCanvasRef}/>
                            {
                                !this.state.cropRectangle ? null : (
                                    <div className='cropMask' style={cropStyle}/>
                                )
                            }
                        </div>
                        {
                            !this.state.pageError ? null : (
                                <div>
                                    Error loading page: {this.state.pageError}
                                </div>
                            )
                        }
                    </GestureControls>
                </div>
            </RenameFileEditor>
        );
    }
}
