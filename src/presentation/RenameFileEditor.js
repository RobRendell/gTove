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
        const suffix = this.props.metadata.name.replace(/.*(\.[a-zA-Z]*)?$/, '$1');
        const name = this.state.name + suffix;
        updateFileMetadataOnDrive({id: this.props.metadata.id, name})
            .then((driveMetadata) => {
                if (driveMetadata.appProperties.gmFile) {
                    // If there's an associated gmFile, rename it as well
                    this.props.dispatch(updateFileAction(driveMetadata));
                    return updateFileMetadataOnDrive({id: this.props.metadata.appProperties.gmFile, name});
                } else {
                    return driveMetadata;
                }
            })
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
                        <button onClick={this.onSave}>Save</button>
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