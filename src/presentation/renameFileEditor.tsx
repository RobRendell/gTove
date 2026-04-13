import {useCallback, useState} from 'react';

import InputField from '../container/inputField';
import MetadataEditorComponent, {MetadataEditorComponentProps} from '../container/metadataEditorComponent';
import {AnyAppProperties, AnyProperties} from '../util/storage/storageContract';
import {splitFileName} from '../util/storage/storageUtils';

export interface RenameFileEditorProps<T extends AnyAppProperties, U extends AnyProperties> extends MetadataEditorComponentProps<T, U> {
}

const RenameFileEditor = <T extends AnyAppProperties, U extends AnyProperties>({
                                                                                   metadata,
                                                                                   onClose,
                                                                                   getSaveMetadata,
                                                                                   allowSave,
                                                                                   className,
                                                                                   controls,
                                                                                   hideControls,
                                                                                   onSave,
                                                                                   children
                                                                               }: RenameFileEditorProps<T, U>) => {
    const [name, setName] = useState(fileNameToFriendlyName(metadata.name));

    const getNameSaveMetadata = useCallback(() => {
        const {suffix} = splitFileName(metadata.name);
        return {
            ...getSaveMetadata?.(),
            name: name + suffix
        };
    }, [getSaveMetadata, metadata.name, name]);

    return (
        <MetadataEditorComponent
            metadata={metadata}
            onClose={onClose}
            getSaveMetadata={getNameSaveMetadata}
            allowSave={allowSave}
            className={className}
            controls={[
                <InputField key='nameField' heading='File name' type='text' initialValue={name} onChange={setName} />,
                ...(controls ?? [])
            ]}
            hideControls={hideControls}
            onSave={onSave}
        >
            {children}
        </MetadataEditorComponent>
    );
};

export default RenameFileEditor;

function fileNameToFriendlyName(filename: string) {
    const {name} = splitFileName(filename);
    return name
        .replace(/([a-z])([A-Z])/, '$1 $2')
        .replace(/_/g, ' ');
}