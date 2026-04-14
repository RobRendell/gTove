import './pdfViewer.scss';

import classNames from 'classnames';
import {useGranularEffect} from 'granular-hooks';
import {getDocument, PDFDocumentProxy} from 'pdfjs-dist';
import {OptionalContentConfig} from 'pdfjs-dist/types/src/display/optional_content_config';
import {
    CSSProperties,
    forwardRef,
    PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState
} from 'react';

import {FileAPIContextObject} from '../context/fileAPIProvider';
import {PromiseModalContextObject} from '../context/promiseModalProvider';
import {useForceUpdate} from '../hooks/useForceUpdate';
import {FileMetadata} from '../util/storage/storageContract';

export const PDF_WRAPPER_MARGIN = 20;

interface PdfViewerProps extends PropsWithChildren {
    metadata: FileMetadata;
    className?: string;
    style?: CSSProperties;
    pageNumber?: number;
    zoomFactor?: number;
    onPdfLoaded: (numPages: number, contentConfig?: OptionalContentConfig) => void;
    onCanvasSizeChanged?: (size: {width: number, height: number}) => void;
}

const PdfViewer = forwardRef<HTMLCanvasElement, PdfViewerProps>(({
                                                                     metadata,
                                                                     className,
                                                                     style,
                                                                     pageNumber = 1,
                                                                     zoomFactor = 1,
                                                                     onPdfLoaded,
                                                                     onCanvasSizeChanged,
                                                                     children
                                                                 }, ref) => {
    const forceUpdate = useForceUpdate();
    const fileAPI = useContext(FileAPIContextObject);
    const promiseModal = useContext(PromiseModalContextObject);
    
    const [pdfProxy, setPdfProxy] = useState<PDFDocumentProxy | undefined>();
    const [contentConfig, setContentConfig] = useState<OptionalContentConfig | undefined>();
    const [error, setError] = useState<string | undefined>();
    const [pdfCanvasSize, setPdfCanvasSize] = useState<{width: number; height: number} | undefined>();

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const renderingPageRef = useRef(false);

    useImperativeHandle(ref, () => (canvasRef.current!));

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
                setError(undefined);
                return;
            }
        }
        setError('This PDF requires a password');
    }, [promiseModal]);

    useGranularEffect(() => {
        (async () => {
            const pdfBlob = await fileAPI.getFileContents(metadata);
            const data = await pdfBlob.arrayBuffer();
            const document = getDocument(new Uint8Array(data));
            (document as any).onPassword = requestPassword;
            try {
                const pdfProxy = await document.promise;
                const contentConfig = await pdfProxy.getOptionalContentConfig();
                setPdfProxy(pdfProxy);
                setContentConfig(contentConfig);
                onPdfLoaded(pdfProxy.numPages, contentConfig);
            } catch (e: any) {
                console.error(`Error loading PDF ${metadata.name}:`, e);
                setError(`Error loading PDF: ${e.message}`);
            }
        })();
    }, [], [fileAPI, metadata, requestPassword]);

    useEffect(() => {
        // Re-render the PDF page when any of a number of props change.
        (async () => {
            const canvas = canvasRef.current;
            if (canvas && pdfProxy && pageNumber > 0 && pageNumber <= pdfProxy.numPages && !renderingPageRef.current) {
                renderingPageRef.current = true;
                setError(undefined);
                const canvasContext = canvas.getContext('2d');
                if (!canvasContext) {
                    throw new Error('Failed to get 2D context from canvas');
                }
                try {
                    const page = await pdfProxy.getPage(pageNumber);
                    const viewport = page.getViewport({scale: zoomFactor});
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const renderTask = page.render({
                        canvas, canvasContext, viewport,
                        ...(contentConfig === undefined ? undefined : {optionalContentConfigPromise: Promise.resolve(contentConfig)})
                    });
                    await renderTask.promise;
                    setPdfCanvasSize({width: canvas.width, height: canvas.height});
                    forceUpdate();
                    renderingPageRef.current = false;
                } catch (e: any) {
                    console.error(`Refreshing page ${pageNumber} threw exception:`, e);
                    setError(`Error loading page ${pageNumber}: ${e.message}`);
                }
            }
        })();
    }, [contentConfig, pageNumber, forceUpdate, pdfProxy, zoomFactor, error]);

    useEffect(() => {
        if (pdfCanvasSize && onCanvasSizeChanged) {
            onCanvasSizeChanged(pdfCanvasSize);
        }
    }, [onCanvasSizeChanged, pdfCanvasSize]);

    const wrapperStyle = useMemo<CSSProperties>(() => ({
        width: pdfCanvasSize?.width ?? '100%',
        height: pdfCanvasSize?.height ?? '100%',
        margin: PDF_WRAPPER_MARGIN,
        ...style
    }), [pdfCanvasSize?.height, pdfCanvasSize?.width, style]);

    return (
        <div className={classNames('pdfViewer', className)} style={wrapperStyle}>
            {
                !error ? null : (
                    <div className='pdfError'>{error}</div>
                )
            }
            <canvas ref={canvasRef}/>
            {children}
        </div>
    );
});

export default PdfViewer;