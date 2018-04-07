import React, {Component} from 'react';
import PropTypes from 'prop-types';

import {splitFileName, updateFileMetadataAndDispatch} from '../util/fileUtils';
import InputField from './InputField';
import EditorFrame from './EditorFrame';

class RenameFileEditor extends Component {

    static propTypes = {
        metadata: PropTypes.object.isRequired,
        name: PropTypes.string.isRequired,
        onClose: PropTypes.func.isRequired,
        dispatch: PropTypes.func.isRequired,
        fileAPI: PropTypes.object.isRequired
    };

    constructor(props) {
        super(props);
        this.onSave = this.onSave.bind(this);
        this.state = {
            name: props.name
        };
    }

    componentWillReceiveProps(props) {
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
                            onChange={(name) => {
                                this.setState({name});
                            }}/>
            </EditorFrame>
        );
    }
}

export default RenameFileEditor;