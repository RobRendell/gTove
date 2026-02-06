import * as React from 'react';
import * as PropTypes from 'prop-types';

import {splitFileName} from '../util/storage/storageUtils';
import InputField from './inputField';
import MetadataEditorComponent, {MetadataEditorComponentProps} from '../container/metadataEditorComponent';
import {AnyAppProperties, AnyProperties, FileMetadata} from '../util/storage/storageContract';

export interface RenameFileEditorProps<T extends AnyAppProperties, U extends AnyProperties> extends MetadataEditorComponentProps<T, U> {
}

interface RenameFileEditorState {
    name: string;
}

class RenameFileEditor<T extends AnyAppProperties, U extends AnyProperties> extends React.Component<RenameFileEditorProps<T, U>, RenameFileEditorState> {

    static propTypes = {
        metadata: PropTypes.object.isRequired,
        onClose: PropTypes.func.isRequired,
        getSaveMetadata: PropTypes.func,
        allowSave: PropTypes.bool,
        controls: PropTypes.arrayOf(PropTypes.object)
    };

    static fileNameToFriendlyName(filename: string) {
        const {name} = splitFileName(filename);
        return name
            .replace(/([a-z])([A-Z])/, '$1 $2')
            .replace(/_/g, ' ');
    }

    constructor(props: RenameFileEditorProps<T, U>) {
        super(props);
        this.getSaveMetadata = this.getSaveMetadata.bind(this);
        this.state = {
            name: RenameFileEditor.fileNameToFriendlyName(props.metadata.name)
        };
    }

    getSaveMetadata(): Partial<FileMetadata<T, U>> {
        const {suffix} = splitFileName(this.props.metadata.name);
        return {
            ...(this.props.getSaveMetadata && this.props.getSaveMetadata()),
            name: this.state.name + suffix
        };
    }

    render() {
        const {children, ...otherProps} = this.props;
        return (
            <MetadataEditorComponent
                {...otherProps as any}
                getSaveMetadata={this.getSaveMetadata}
                controls={[
                    <InputField key='nameField' heading='File name' type='text' initialValue={this.state.name}
                                onChange={(name: string) => {
                                    this.setState({name});
                                }}/>,
                    ...(this.props.controls || [])
                ]}
            >
                {children}
            </MetadataEditorComponent>
        );
    }
}

export default RenameFileEditor;