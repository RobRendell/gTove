import * as React from 'react';
import * as PropTypes from 'prop-types';
import {Dispatch} from 'redux';

import {FileAPI, splitFileName, updateFileMetadataAndDispatch} from '../util/fileUtils';
import InputField from './inputField';
import EditorFrame from './editorFrame';
import {DriveMetadata} from '../@types/googleDrive';
import {ReduxStoreType} from '../redux/mainReducer';

interface RenameFileEditorProps {
    metadata: DriveMetadata;
    name: string;
    onClose: () => void;
    dispatch: Dispatch<ReduxStoreType>;
    fileAPI: FileAPI;
}

interface RenameFileEditorState {
    name: string;
}

class RenameFileEditor extends React.Component<RenameFileEditorProps, RenameFileEditorState> {

    static propTypes = {
        metadata: PropTypes.object.isRequired,
        name: PropTypes.string.isRequired,
        onClose: PropTypes.func.isRequired,
        dispatch: PropTypes.func.isRequired,
        fileAPI: PropTypes.object.isRequired
    };

    constructor(props: RenameFileEditorProps) {
        super(props);
        this.onSave = this.onSave.bind(this);
        this.state = {
            name: props.name
        };
    }

    componentWillReceiveProps(props: RenameFileEditorProps) {
        if (props.name !== this.props.name) {
            this.setState({name: props.name});
        }
    }

    onSave() {
        const {suffix} = splitFileName(this.props.metadata.name);
        return updateFileMetadataAndDispatch(this.props.fileAPI, {id: this.props.metadata.id, name: this.state.name + suffix}, this.props.dispatch);
    }

    render() {
        return (
            <EditorFrame onClose={this.props.onClose} onSave={this.onSave}>
                <InputField heading='File name' type='text' initialValue={this.state.name}
                            onChange={(name: string) => {
                                this.setState({name});
                            }}/>
            </EditorFrame>
        );
    }
}

export default RenameFileEditor;