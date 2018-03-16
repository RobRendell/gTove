import React, {Component} from 'react';
import PropTypes from 'prop-types';

import {updateFileMetadataOnDrive} from '../util/googleAPIUtils';
import {updateFileAction} from '../redux/fileIndexReducer';
import InputField from './InputField';

class RenameFileEditor extends Component {

    static propTypes = {
        metadata: PropTypes.object.isRequired,
        name: PropTypes.string.isRequired,
        files: PropTypes.object.isRequired,
        onClose: PropTypes.func.isRequired,
        dispatch: PropTypes.func.isRequired
    };

    constructor(props) {
        super(props);
        this.onSave = this.onSave.bind(this);
        this.state = {
            name: props.name,
            loadError: null,
            saving: false
        };
    }

    onSave() {
        this.setState({saving: true});
        let suffix = this.props.metadata.name.replace(/.*(\.[a-zA-Z]*)?$/, '$1');
        let metadata = {
            id: this.props.metadata.id,
            name: this.state.name + suffix
        };
        updateFileMetadataOnDrive(metadata)
            .then((driveMetadata) => {
                this.props.dispatch(updateFileAction(driveMetadata));
                this.props.onClose();
            });
    }

    render() {
        if (this.state.saving) {
            return (
                <div className='mapEditor'>
                    <span>Saving data to Google Drive...</span>
                </div>
            );
        } else {
            return (
                <div className='mapEditor'>
                    <div>
                        <button onClick={this.props.onClose}>Cancel</button>
                        <button onClick={this.onSave} disabled={this.state.name === this.props.name}>Save</button>
                        <InputField heading='File name' type='text' initialValue={this.state.name}
                            onChange={(name) => {
                                this.setState({name});
                            }}/>
                    </div>
                </div>
            );
        }
    }
}

export default RenameFileEditor;