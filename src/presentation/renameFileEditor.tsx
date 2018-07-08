import * as React from 'react';
import * as PropTypes from 'prop-types';

import {splitFileName} from '../util/fileUtils';
import InputField from './inputField';
import MetadataEditorComponent, {MetadataEditorComponentProps} from '../container/metadataEditorComponent';
import {DriveMetadata} from '../util/googleDriveUtils';

export interface RenameFileEditorProps extends MetadataEditorComponentProps {
}

interface RenameFileEditorState {
    name: string;
}

class RenameFileEditor extends React.Component<RenameFileEditorProps, RenameFileEditorState> {

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
            .replace(/\.[a-z]*$/g, '')
            .replace(/_/g, ' ');
    }

    constructor(props: RenameFileEditorProps) {
        super(props);
        this.getSaveMetadata = this.getSaveMetadata.bind(this);
        this.state = {
            name: RenameFileEditor.fileNameToFriendlyName(props.metadata.name)
        };
    }

    getSaveMetadata(): Partial<DriveMetadata> {
        const {suffix} = splitFileName(this.props.metadata.name);
        return {
            ...(this.props.getSaveMetadata && this.props.getSaveMetadata()),
            name: this.state.name + suffix
        };
    }

    render() {
        return (
            <MetadataEditorComponent
                {...this.props}
                getSaveMetadata={this.getSaveMetadata}
                controls={[
                    <InputField key='nameField' heading='File name' type='text' initialValue={this.state.name}
                                onChange={(name: string) => {
                                    this.setState({name});
                                }}/>,
                    ...(this.props.controls || [])
                ]}
            >
                {this.props.children}
            </MetadataEditorComponent>
        );
    }
}

export default RenameFileEditor;