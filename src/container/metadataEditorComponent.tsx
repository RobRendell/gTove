import * as React from 'react';
import * as PropTypes from 'prop-types';
import {connect} from 'react-redux';

import {AnyAppProperties, AnyProperties, DriveMetadata, isDriveFileShortcut} from '../util/googleDriveUtils';
import {FileAPIContext, updateFileMetadataAndDispatch} from '../util/fileUtils';
import ConfigPanelWrapper from './configPanelWrapper';
import {GtoveDispatchProp} from '../redux/mainReducer';

export interface MetadataEditorComponentProps<T extends AnyAppProperties, U extends AnyProperties> {
    metadata: DriveMetadata<T, U>;
    onClose: () => void;
    getSaveMetadata: () => Partial<DriveMetadata<T, U>>;
    allowSave?: boolean;
    className?: string;
    controls?: React.ReactNode[];
    hideControls?: boolean;
    onSave?: (metadata: DriveMetadata<T, U>) => Promise<any>;
}

interface MetadataEditorComponentState {
    saving: boolean;
}

class MetadataEditorComponent<T extends AnyAppProperties, U extends AnyProperties> extends React.Component<MetadataEditorComponentProps<T, U> & GtoveDispatchProp, MetadataEditorComponentState> {

    static defaultProps = {
        allowSave: true
    };

    static contextTypes = {
        fileAPI: PropTypes.object
    };

    context: FileAPIContext;

    constructor(props: MetadataEditorComponentProps<T, U> & GtoveDispatchProp) {
        super(props);
        this.onSave = this.onSave.bind(this);
        this.state = {
            saving: false
        };
    }

    async onSave() {
        this.setState({saving: true});
        const saveMetadata = this.props.getSaveMetadata();
        const metadata = {
            ...saveMetadata,
            id: isDriveFileShortcut(saveMetadata) ? saveMetadata.properties.ownedMetadataId : this.props.metadata.id,
        };
        const savedMetadata = await updateFileMetadataAndDispatch(this.context.fileAPI, metadata, this.props.dispatch, true) as DriveMetadata<T, U>;
        if (this.props.onSave) {
            await this.props.onSave(savedMetadata);
        }
        this.setState({saving: false});
        this.props.onClose();
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
                <ConfigPanelWrapper
                    onClose={this.props.onClose}
                    onSave={this.onSave}
                    disableSave={!this.props.allowSave}
                    className={this.props.className}
                    controls={this.props.controls}
                    hideControls={this.props.hideControls}
                >
                    {this.props.children}
                </ConfigPanelWrapper>
            );
        }
    }
}

export default connect()(MetadataEditorComponent);