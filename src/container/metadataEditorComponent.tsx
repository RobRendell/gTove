import {PropsWithChildren, ReactNode, useCallback, useContext, useState} from 'react';
import {useDispatch} from 'react-redux';

import {FileAPIContextObject} from '../context/fileAPIProvider';
import {AnyAppProperties, AnyProperties, FileMetadata} from '../util/storage/storageContract';
import {isFileShortcut, updateFileMetadataAndDispatch} from '../util/storage/storageUtils';
import ConfigPanelWrapper from './configPanelWrapper';

export interface MetadataEditorComponentProps<T extends AnyAppProperties, U extends AnyProperties> extends PropsWithChildren {
    metadata: FileMetadata<T, U>;
    onClose: () => void;
    getSaveMetadata: () => Partial<FileMetadata<T, U>>;
    allowSave?: boolean;
    className?: string;
    controls?: ReactNode[];
    hideControls?: boolean;
    onSave?: (metadata: FileMetadata<T, U>) => Promise<any>;
}

const MetadataEditorComponent = <T extends AnyAppProperties, U extends AnyProperties>({
    metadata,
    onClose,
    getSaveMetadata,
    allowSave = true,
    className,
    controls,
    hideControls,
    onSave,
    children
}: MetadataEditorComponentProps<T, U>) => {
    const fileAPI = useContext(FileAPIContextObject);
    const dispatch = useDispatch();

    const [saving, setSaving] = useState(false);

    const onConfigSave = useCallback(async () => {
        setSaving(true);
        const saveMetadata = getSaveMetadata();
        const savedMetadata = await updateFileMetadataAndDispatch(fileAPI, {
            ...saveMetadata,
            id: isFileShortcut(saveMetadata) ? saveMetadata.properties!.ownedMetadataId : metadata.id,
        }, dispatch, true) as FileMetadata<T, U>;
        if (onSave) {
            await onSave(savedMetadata);
        }
        setSaving(false);
        onClose();
    }, [dispatch, fileAPI, getSaveMetadata, metadata.id, onClose, onSave])

    return saving ? (
        <div>
            <span>Saving...</span>
        </div>
    ) : (
        <ConfigPanelWrapper
            onClose={onClose}
            onSave={onConfigSave}
            disableSave={!allowSave}
            className={className}
            controls={controls}
            hideControls={hideControls}
        >
            {children}
        </ConfigPanelWrapper>
    );
}

export default MetadataEditorComponent;