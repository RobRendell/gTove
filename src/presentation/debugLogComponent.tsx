import React, {Component} from 'react';
import {connect} from 'react-redux';
import ReactDropdown from 'react-dropdown-now';
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

    getOptions(types: {[type: string]: boolean}) {
        return [DebugLogComponent.ALL_TYPES].concat(Object.keys(types)).map((option) => ({
            value: option,
            label: option
        }));
    }

    render() {
        return (
            <div className='debugLog'>
                <div className='controls'>
                    <InputButton type='button' onChange={() => {this.props.onFinish()}}>Close</InputButton>
                    <ReactDropdown
                        className='select'
                        options={this.getOptions(this.props.debugLog.types)}
                        value={({value: this.state.selectedType, label: this.state.selectedType})}
                        onChange={(value: any) => {
                            this.setState({selectedType: value.value});
                        }}
                    />
                </div>
                <div className='messages'>
                {
                    this.props.debugLog.messages
                        .filter((message) => (this.state.selectedType === DebugLogComponent.ALL_TYPES || this.state.selectedType === message.logType))
                        .map((message, index) => (
                            <div key={'log' + index}>
                                {message.logType}: {message.message}
                            </div>
                        ))
                }
                </div>
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