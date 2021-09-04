import {Component, createRef} from 'react';
import * as PropTypes from 'prop-types';
import {getDocument, GlobalWorkerOptions} from 'pdfjs-dist/legacy/build/pdf';
import {PDFDocumentProxy} from 'pdfjs-dist/types/display/api';
// @ts-ignore
// eslint-disable-next-line import/no-webpack-loader-syntax
import PdfJsWorker from 'worker-loader!pdfjs-dist/build/pdf.worker.js';
import classNames from 'classnames';

import './pdfFileEditor.scss';

import RenameFileEditor from './renameFileEditor';
import {DriveMetadata, MapProperties, MiniProperties} from '../util/googleDriveUtils';
import {FileAPIContext} from '../util/fileUtils';
import InputButton from './inputButton';
import InputField from './inputField';
import {PromiseModalContext} from '../container/authenticatedContainer';
import GestureControls from '../container/gestureControls';
import {ObjectVector2} from '../util/scenarioUtils';
import {FileIndexReducerType} from '../redux/fileIndexReducer';
import MiniEditor from './miniEditor';
import MapEditor from './mapEditor';
import DriveTextureLoader from '../util/driveTextureLoader';

interface PdfFileEditorProps {
    metadata: DriveMetadata<void, void>;
    onClose: () => void;
    onSave?: (metadata: DriveMetadata<void, void>) => Promise<any>;
    getSaveMetadata: () => Partial<DriveMetadata<void, void>>;
    className?: string;
    textureLoader: DriveTextureLoader;
    miniFolderStack: string[];
    mapFolderStack: string[];
    files: FileIndexReducerType;
}

interface PdfFileEditorState {
    saving: boolean;
    currentPage: number;
    numPages: number;
    pdfProxy?: PDFDocumentProxy;
    loadError?: string;
    pageError?: string;
    cropRectangle?: ObjectVector2[];
    adjustingCropRectangle: CropAdjustment;
    prepareSaveCrop: boolean;
    savingCrop: boolean;
    editCrop?: DriveMetadata;
    isSavingMap: boolean;
    savingCanvasRotation: number;
}

/** The max distance from the drag border to be considered for crop rect resizing. */
const CROP_ADJUSTMENT_DRAG_MARGIN = 32;

/**
 * The possible states for adjusting crop. Use {@link isCropAdjusting} to check if it is active.
 */
enum CropAdjustment {
    NONE = 0,
    RESIZING,
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
        default: return 'unset';
    }
}

export default class PdfFileEditor extends Component<PdfFileEditorProps, PdfFileEditorState> {

    static contextTypes = {
        fileAPI: PropTypes.object,
        promiseModal: PropTypes.func
    };

    context: FileAPIContext & PromiseModalContext;

    private pageCanvasRef = createRef<HTMLCanvasElement>();
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
        this.onGestureEnd = this.onGestureEnd.bind(this);
        this.updateSavingCanvas = this.updateSavingCanvas.bind(this);
        this.state = {
            saving: false,
            currentPage: 1,
            numPages: 0,
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
        } catch (e) {
            console.error(`Error loading PDF ${this.props.metadata.name}:`, e);
            this.setState({loadError: e.message});
        }
    }

    async requestPassword(setPassword: (password: string) => void, reason: number) {
        if (this.context.promiseModal && !this.context.promiseModal.isBusy()) {
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
    }

    async refreshPage() {
        const {currentPage, pdfProxy} = this.state;
        const canvas = this.pageCanvasRef.current;
        if (!this.refreshing && canvas && pdfProxy && currentPage > 0 && currentPage <= this.state.numPages) {
            this.refreshing = true;
            const canvasContext = canvas.getContext('2d');
            if (!canvasContext) {
                throw new Error('Failed to get 2D context from canvas');
            }
            try {
                const page = await pdfProxy.getPage(currentPage);
                const viewport = page.getViewport({scale: 1});
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await page.render({canvasContext, viewport}).promise;
                this.refreshing = false;
                if (currentPage !== this.state.currentPage) {
                    // Page changed in the meantime.
                    await this.refreshPage();
                }
            } catch (e) {
                console.error(`Refreshing page ${currentPage} threw exception:`, e);
                this.setState({pageError: e.message});
            }
        }
    }

    async onSave(saveMetadata: DriveMetadata<void, void>) {
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
        if (rectangle) {
            const {left, top, right, bottom} = rectangle;
            const {x: startX, y: startY} = startPos;
            const margin = CROP_ADJUSTMENT_DRAG_MARGIN;
            if (isPointWithinBounds(startX, startY, left - margin, top - margin, right + margin, bottom + margin)
                && !isPointWithinBounds(startX, startY, left + margin, top + margin, right - margin, bottom - margin)) {
                // Resize time!
                const centerX = (left + right) / 2;
                const centerY = (top + bottom) / 2;
                let x = startPos.x < centerX ? right : left;
                let y = startPos.y < centerY ? bottom : top;
                this.setState({adjustingCropRectangle: CropAdjustment.RESIZING, cropRectangle: [{x, y}, startPos]});   
            } else {
                // Reposition time!
                let a = { x: left, y: top };
                let b = { x: right, y: bottom };
                let dragStart = startPos;
                this.setState({adjustingCropRectangle: CropAdjustment.POSITIONING, cropRectangle: [a, b, dragStart]});
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
        switch(adjustingCropRectangle) {
            case CropAdjustment.POSITIONING:
                {
                    let prev = cropRectangle[2];
                    let deltaX = position.x - prev.x;
                    let deltaY = position.y - prev.y;
                    let a = cropRectangle[0];
                    let b = cropRectangle[1];
                    this.setState({
                        cropRectangle: [
                            { x: a.x + deltaX, y: a.y + deltaY },
                            { x: b.x + deltaX, y: b.y + deltaY },
                            position
                        ]
                    });
                }
                break;
            case CropAdjustment.RESIZING:
                this.setState({
                    cropRectangle: [cropRectangle[0], position]
                });
                break;
            default:
                throw new Error(`Unknown crop adjustment state ${adjustingCropRectangle}.`);
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
            this.savingCanvas.width = this.state.savingCanvasRotation % 2 === 0 ? width : height;
            this.savingCanvas.height = this.state.savingCanvasRotation % 2 === 0 ? height : width;
            context.translate(this.savingCanvas.width / 2, this.savingCanvas.height / 2);
            context.rotate(this.state.savingCanvasRotation * Math.PI / 2);
            context.clearRect(0, 0, width, height);
            context.drawImage(this.pageCanvasRef.current, left, top, width, height,
                -width / 2, -height / 2, width, height);
        }
    }

    getCropSavePath() {
        const folderStack = (this.state.isSavingMap) ? this.props.mapFolderStack : this.props.miniFolderStack;
        const folderNames = folderStack.map((fileId) => (this.props.files.driveMetadata[fileId].name));
        return folderNames.join(' \u232A ');
    }

    renderSavingCrop() {
        return this.state.savingCrop ? (
            <div>
                Saving cropped image to {this.getCropSavePath()}...
            </div>
        ) : (
            <div>
                <p><b>Save to: </b> {this.getCropSavePath()}</p>
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
                    this.setState({editCrop: {
                            ...metadata,
                            properties: {
                                pageCrop: {
                                    pdfMetadataId: this.props.metadata.id,
                                    page: this.state.currentPage,
                                    rotation: this.state.savingCanvasRotation * 90,
                                    top: this.getCropRectangle()!.top,
                                    left: this.getCropRectangle()!.left
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
            return {wrapperStyle: {height: '0', overflow: 'hidden'}, cropStyle: undefined};
        } else if (!this.pageCanvasRef.current) {
            return {wrapperStyle: {width: '100%', height: '100%'}, cropStyle: undefined};
        }
        const rectangle = this.getCropRectangle();
        const wrapperStyle: React.CSSProperties = {
            width: this.pageCanvasRef.current.width,
            height: this.pageCanvasRef.current.height,
            overflow: rectangle ? 'hidden' : 'visible',
            cursor: rectangle ? getCropAdjustmentCursor(this.state.adjustingCropRectangle) : 'unset',
        };
        const cropStyle = rectangle ? {
            left: rectangle.left,
            top: rectangle.top,
            right: this.pageCanvasRef.current.width - rectangle.right,
            bottom: this.pageCanvasRef.current.height - rectangle.bottom
        } : undefined;
        return {wrapperStyle, cropStyle};
    }

    render() {
        const {wrapperStyle, cropStyle} = this.calculateStyles();
        return this.state.saving ? (
            <div>
                Saving...
            </div>
        ) : (
            <RenameFileEditor
                className='fullHeight'
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
                            <MapEditor metadata={this.state.editCrop as DriveMetadata<void, MapProperties>}
                                       onClose={() => {
                                           this.setState({editCrop: undefined});
                                       }}
                                       textureLoader={this.props.textureLoader}
                            />
                        )  : (
                            <MiniEditor metadata={this.state.editCrop as DriveMetadata<void, MiniProperties>}
                                        onClose={() => {
                                            this.setState({editCrop: undefined});
                                        }}
                                        textureLoader={this.props.textureLoader}
                            />
                        )
                    ) : this.state.pdfProxy ? (
                        <div>
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
                    ) : (
                        <div>
                            Loading...
                        </div>
                    )
                }
                <GestureControls
                    onGestureStart={this.onGestureStart}
                    onPan={this.onPan}
                    onGestureEnd={this.onGestureEnd}
                >
                    <div className={classNames('canvasWrapper', {
                        hidden: this.state.prepareSaveCrop || this.state.editCrop !== undefined
                    })} onMouseOver={() => {}} style={wrapperStyle}>
                        <canvas ref={this.pageCanvasRef}/>
                        {
                            !this.state.cropRectangle ? null : (
                                <div className='cropMask' style={cropStyle}/>
                            )
                        }
                    </div>
                </GestureControls>
                {
                    !this.state.pageError ? null : (
                        <div>
                            Error loading page: {this.state.pageError}
                        </div>
                    )
                }
            </RenameFileEditor>
        );
    }
}
