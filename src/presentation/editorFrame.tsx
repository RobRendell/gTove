import * as React from 'react';
import * as PropTypes from 'prop-types';

import {ComponentTypeWithDefaultProps} from '../util/types';

interface EditorFrameProps {
    onClose: () => void;
    onSave: () => Promise<void>;
    allowSave?: boolean;
    className?: string;
}

interface EditorFrameState {
    saving: boolean;
}

class EditorFrame extends React.Component<EditorFrameProps, EditorFrameState> {

    static propTypes = {
        onClose: PropTypes.func.isRequired,
        onSave: PropTypes.func.isRequired,
        allowSave: PropTypes.bool,
        className: PropTypes.string
    };

    static defaultProps = {
        allowSave: true
    };

    constructor(props: EditorFrameProps) {
        super(props);
        this.state = {
            saving: false
        };
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
                    <div>
                        <button onClick={this.props.onClose}>Cancel</button>
                        <button disabled={!this.props.allowSave} onClick={() => {
                            this.setState({saving: true});
                            this.props.onSave()
                                .then(() => {
                                    this.setState({saving: false});
                                    this.props.onClose();
                                })
                        }}>Save</button>
                    </div>
                    {
                        this.props.children
                    }
                </div>
            );
        }
    }
}

export default EditorFrame as ComponentTypeWithDefaultProps<typeof EditorFrame>;