import React, {Component} from 'react';
import {connect} from 'react-redux';
import Select, {Option} from 'react-select';
import memoizeOne from 'memoize-one';

import {getDebugLogFromStore, ReduxStoreType} from '../redux/mainReducer';
import {DebugLogReducerType} from '../redux/debugLogReducer';
import InputButton from './inputButton';

import './debugLogComponent.scss';

interface DebugLogComponentProps {
    debugLog: DebugLogReducerType;
    onFinish: () => void;
}

interface DebugLogComponentState {
    selectedType: string;
}

class DebugLogComponent extends Component<DebugLogComponentProps, DebugLogComponentState> {

    static ALL_TYPES = '*';

    constructor(props: DebugLogComponentProps) {
        super(props);
        this.getOptions = memoizeOne(this.getOptions.bind(this));
        this.state = {
            selectedType: DebugLogComponent.ALL_TYPES
        }
    }

    getOptions(types: {[type: string]: boolean}): Option<string>[] {
        return [DebugLogComponent.ALL_TYPES].concat(Object.keys(types)).map((option) => ({
            value: option,
            label: option
        }));
    }

    render() {
        return (
            <div className='debugLog'>
                {
                    this.props.debugLog.messages
                        .filter((message) => (this.state.selectedType === DebugLogComponent.ALL_TYPES || this.state.selectedType === message.logType))
                        .map((message, index) => (
                            <div key={'log' + index}>
                                {message.logType}: {message.message}
                            </div>
                        ))
                }
                <InputButton type='button' onChange={() => {this.props.onFinish()}}>Close</InputButton>
                <Select
                    options={this.getOptions(this.props.debugLog.types)}
                    value={({value: this.state.selectedType, label: this.state.selectedType})}
                    onChange={(value) => {
                        if (value && !Array.isArray(value) && value.value) {
                            this.setState({selectedType: value.value})
                        } else {
                            this.setState({selectedType: DebugLogComponent.ALL_TYPES})
                        }
                    }}
                />
            </div>
        );
    }

}

function mapStoreToProps(store: ReduxStoreType) {
    return {
        debugLog: getDebugLogFromStore(store)
    }
}

export default connect(mapStoreToProps)(DebugLogComponent);