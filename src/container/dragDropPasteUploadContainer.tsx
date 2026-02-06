import {
    DragEvent,
    FunctionComponent,
    PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useState
} from 'react';
import classNames from 'classnames';
import {toast} from 'react-toastify';
import {useStore} from 'react-redux';

import {uploadMultipleFiles, UploadType} from '../util/uploadUtils';
import {FileAPIContextObject} from '../context/fileAPIContextBridge';
import {FileMetadata} from '../util/storage/storageContract';

type DragDropPasteUploadContainerProps = PropsWithChildren<{
    topDirectory: string;
    handlePasteText?: (text: string) => unknown;
    onPlaceholdersCreated?: (metadata: FileMetadata[]) => void;
    disabled?: boolean;
}>;

export const DragDropPasteUploadContainer: FunctionComponent<DragDropPasteUploadContainerProps> = (
    {
        topDirectory,
        handlePasteText,
        onPlaceholdersCreated,
        disabled,
        children
    }
) => {
    const [fileDragActive, setFileDragActive] = useState(false);
    const store = useStore();
    const fileAPI = useContext(FileAPIContextObject);

    const onPaste = useCallback(async (event: ClipboardEvent) => {
        // Only support paste on pages which allow upload.
        if (!disabled && event.clipboardData) {
            if (event.clipboardData.files && event.clipboardData.files.length > 0) {
                const placeholders = await uploadMultipleFiles(store, fileAPI, topDirectory, {
                    name: '.',
                    files: Array.from(event.clipboardData.files)
                });
                onPlaceholdersCreated?.(placeholders);
            } else {
                handlePasteText?.(event.clipboardData.getData('text'));
            }
        }
    }, [disabled, store, fileAPI, topDirectory, handlePasteText, onPlaceholdersCreated]);

    // Effect to register onPaste events (done manually because user-select: none disables clipboard events in Chrome)
    useEffect(() => {
        document.addEventListener('paste', onPaste);
        return () => {
            document.removeEventListener('paste', onPaste);
        };
    }, [onPaste]);

    const onFileDragDrop = useCallback(async (event: DragEvent<HTMLDivElement>) => {
        // Default behaviour of the dragOver event is to "reset the current drag operation to none", so it needs
        // to be prevented for file drag & drop to work.
        event.preventDefault();
        if (!disabled) {
            // Only handle file drag and drop on pages which allow upload.
            switch (event.type) {
                case 'dragenter':
                case 'dragleave':
                    setFileDragActive(event.type === 'dragenter');
                    break;
                case 'drop':
                    setFileDragActive(false);
                    const dataTransfer = event.nativeEvent.dataTransfer;
                    if (dataTransfer) {
                        let upload: UploadType;
                        if (dataTransfer.items) {
                            upload = await getUploadFromDataTransferItemList(dataTransfer.items);
                        } else if (dataTransfer.files) {
                            upload = {name: '.', files: []};
                            for (let file of dataTransfer.files) {
                                upload.files.push(file);
                            }
                        } else {
                            toast('File drag and drop not supported on this browser.');
                            break;
                        }
                        try {
                            const placeholders = await uploadMultipleFiles(store, fileAPI, topDirectory, upload);
                            onPlaceholdersCreated?.(placeholders);
                        } catch (e) {
                            toast('Failed to upload dragged files/folders.');
                            console.error('Failed to upload dragged files/folders.', e);
                        }
                    } else {
                        toast('File drag and drop not supported on this browser.');
                    }
                    break;
            }
        }
    }, [store, fileAPI, topDirectory, disabled, onPlaceholdersCreated]);

    return (
        <div className={classNames('fullHeight noOverflow', {fileDragActive})}
             onDragEnter={onFileDragDrop} onDragLeave={onFileDragDrop} onDragOver={onFileDragDrop}
             onDrop={onFileDragDrop}
        >
            {children}
        </div>
    );
};

async function getUploadFromDataTransferItemList(itemList: DataTransferItemList): Promise<UploadType> {
    // Attempt to use experimental webkitGetAsEntry approach, to allow uploading whole directories
    if (itemList.length && typeof (itemList[0].webkitGetAsEntry) === 'function') {
        const entries: any[] = [];
        for (let item of itemList) {
            entries.push(item.webkitGetAsEntry());
        }
        return getUploadFromEntryList(entries);
    } else {
        const result: UploadType = {
            name: '.',
            files: []
        };
        for (let item of itemList) {
            if (item.kind === 'file') {
                result.files.push(item.getAsFile()!);
            }
        }
        return result;
    }
}

async function getUploadFromEntryList(entryList: any[], name = '.'): Promise<UploadType> {
    const result: UploadType = {name, files: []};
    let resolveDirectoryPromise: () => void;
    const directoryPromise = new Promise<void>((resolve) => {
        resolveDirectoryPromise = resolve
    });
    let remaining = entryList.length + 1;
    const decrementRemaining = () => {
        if (--remaining === 0) {
            resolveDirectoryPromise();
        }
    }
    for (let entry of entryList) {
        if (entry.isFile) {
            entry.file((file: File) => {
                result.files.push(file);
                decrementRemaining();
            });
        } else if (entry.isDirectory) {
            const reader = entry.createReader();
            reader.readEntries(async (directoryEntries: any[]) => {
                result.subdirectories = result.subdirectories || [];
                const subdir = await getUploadFromEntryList(directoryEntries, entry.name);
                result.subdirectories.push(subdir);
                decrementRemaining();
            });
        }
    }
    decrementRemaining(); // in case entryList was empty.
    await directoryPromise;
    return result;
}
