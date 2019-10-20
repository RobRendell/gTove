import * as React from 'react';
import * as PropTypes from 'prop-types';
import {connect, DispatchProp} from 'react-redux';

import {ComponentTypeWithDefaultProps} from '../util/types';
import {AnyAppProperties, DriveMetadata} from '../util/googleDriveUtils';
import {FileAPIContext, updateFileMetadataAndDispatch} from '../util/fileUtils';
import InputButton from '../presentation/inputButton';

export interface MetadataEditorComponentProps<T extends AnyAppProperties> {
    metadata: DriveMetadata<T>;
    onClose: () => void;
    getSaveMetadata: () => Partial<DriveMetadata<T>>;
    allowSave?: boolean;
    className?: string;
    controls?: React.ReactNode[];
    onSave?: (metadata: DriveMetadata<T>) => Promise<any>;
}

interface MetadataEditorComponentState {
    saving: boolean;
}

class MetadataEditorComponent<T extends AnyAppProperties> extends React.Component<MetadataEditorComponentProps<T> & Required<DispatchProp>, MetadataEditorComponentState> {

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

    constructor(props: MetadataEditorComponentProps<T> & Required<DispatchProp>) {
        super(props);
        this.onSave = this.onSave.bind(this);
        this.state = {
            saving: false
        };
    }

    async onSave() {
        this.setState({saving: true});
        const metadata = {
            ...this.props.getSaveMetadata(),
            id: this.props.metadata.id,
        };
        const savedMetadata = await updateFileMetadataAndDispatch(this.context.fileAPI, metadata, this.props.dispatch, true) as DriveMetadata<T>;
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
                <div className={this.props.className}>
                    <div className='controls'>
                        <InputButton type='button' onChange={this.props.onClose}>Cancel</InputButton>
                        <InputButton type='button' disabled={!this.props.allowSave} onChange={this.onSave}>Save</InputButton>
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