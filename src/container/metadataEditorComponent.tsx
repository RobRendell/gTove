import * as React from 'react';
import * as PropTypes from 'prop-types';
import {connect} from 'react-redux';

import {AnyAppProperties, AnyProperties, FileMetadata} from '../util/storage/storageContract';
import { isFileShortcut } from '../util/storage/storageUtils';
import { updateFileMetadataAndDispatch } from '../util/storage/storageUtils';
import ConfigPanelWrapper from './configPanelWrapper';
import {GtoveDispatchProp} from '../redux/mainReducer';
import { FileAPIContext } from '../util/storage/storageContract';

export interface MetadataEditorComponentProps<T extends AnyAppProperties, U extends AnyProperties> {
    metadata: FileMetadata<T, U>;
    onClose: () => void;
    getSaveMetadata: () => Partial<FileMetadata<T, U>>;
    allowSave?: boolean;
    className?: string;
    controls?: React.ReactNode[];
    hideControls?: boolean;
    onSave?: (metadata: FileMetadata<T, U>) => Promise<any>;
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
            id: isFileShortcut(saveMetadata) ? saveMetadata.properties!.ownedMetadataId : this.props.metadata.id,
        };
        const savedMetadata = await updateFileMetadataAndDispatch(this.context.fileAPI, metadata, this.props.dispatch, true) as FileMetadata<T, U>;
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