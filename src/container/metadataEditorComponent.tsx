import * as React from 'react';
import * as PropTypes from 'prop-types';
import {connect, DispatchProp} from 'react-redux';

import {ComponentTypeWithDefaultProps} from '../util/types';
import {DriveMetadata} from '../util/googleDriveUtils';
import {FileAPIContext, updateFileMetadataAndDispatch} from '../util/fileUtils';
import {ReduxStoreType} from '../redux/mainReducer';

export interface MetadataEditorComponentProps {
    metadata: DriveMetadata;
    onClose: () => void;
    getSaveMetadata: () => Partial<DriveMetadata>;
    allowSave?: boolean;
    className?: string;
    controls?: React.ReactNode[];
    onSave?: (metadata: DriveMetadata) => Promise<any>;
}

interface MetadataEditorComponentState {
    saving: boolean;
}

class MetadataEditorComponent extends React.Component<MetadataEditorComponentProps & Required<DispatchProp<ReduxStoreType>>, MetadataEditorComponentState> {

    static propTypes = {
        metadata: PropTypes.object.isRequired,
        onClose: PropTypes.func.isRequired,
        getSaveMetadata: PropTypes.func.isRequired,
        allowSave: PropTypes.bool,
        className: PropTypes.string,
        controls: PropTypes.arrayOf(PropTypes.object),
        onSave: PropTypes.func
    };

    static defaultProps = {
        allowSave: true
    };

    static contextTypes = {
        fileAPI: PropTypes.object
    };

    context: FileAPIContext;

    constructor(props: MetadataEditorComponentProps & Required<DispatchProp<ReduxStoreType>>) {
        super(props);
        this.onSave = this.onSave.bind(this);
        this.state = {
            saving: false
        };
    }

    onSave() {
        this.setState({saving: true});
        const metadata = {
            ...this.props.getSaveMetadata(),
            id: this.props.metadata.id,
        };
        return updateFileMetadataAndDispatch(this.context.fileAPI, metadata, this.props.dispatch, true)
            .then((metadata) => (this.props.onSave && this.props.onSave(metadata)))
            .then(() => {
                this.setState({saving: false});
                this.props.onClose();
            });
    }

    render() {
        if (this.state.saving) {
            return (
                <div>
                    <span>Saving...</span>
                </div>
            );
        } else {
            return (
                <div className={this.props.className}>
                    <div className='controls'>
                        <button onClick={this.props.onClose}>Cancel</button>
                        <button disabled={!this.props.allowSave} onClick={this.onSave}>Save</button>
                        {
                            (this.props.controls || null)
                        }
                    </div>
                    {
                        this.props.children
                    }
                </div>
            );
        }
    }
}

export default connect()(MetadataEditorComponent as ComponentTypeWithDefaultProps<typeof MetadataEditorComponent>);