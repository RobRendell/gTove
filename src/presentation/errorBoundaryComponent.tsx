import {Component, PropsWithChildren} from 'react';
import {connect, DispatchProp} from 'react-redux';

import InputButton from './inputButton';
import {setTabletopIdAction} from '../redux/locationReducer';
import {getTabletopIdFromStore, ReduxStoreType} from '../redux/mainReducer';

import './errorBoundaryComponent.scss';

interface ErrorBoundaryContainerProps extends DispatchProp {
    tabletopId: string;
}

interface ErrorBoundaryContainerState {
    error?: Error;
    showError: boolean;
}

class ErrorBoundaryComponent extends Component<PropsWithChildren<ErrorBoundaryContainerProps>, ErrorBoundaryContainerState> {

    constructor(props: ErrorBoundaryContainerProps) {
        super(props);
        this.displayCurrentTabletop = this.displayCurrentTabletop.bind(this);
        this.displayTabletopsScreen = this.displayTabletopsScreen.bind(this);
        this.state = {
            showError: false
        };
    }

    static getDerivedStateFromError(error: Error) {
        return {error};
    }

    displayCurrentTabletop() {
        this.setState({error: undefined, showError: false});
    }

    displayTabletopsScreen() {
        this.props.dispatch(setTabletopIdAction());
        this.setState({error: undefined, showError: false});
    }

    render() {
        return this.state.error ? (
            <div className='errorBoundaryScreen'>
                <h1>An error occurred!</h1>
                <p>
                    gTove has encountered an error. Sorry about that.
                </p>
                {
                    !this.state.showError ? (
                        <InputButton type='button' onChange={() => {this.setState({showError: true})}}>Show error details</InputButton>
                    ) : (
                        <>
                            <p>Error details:</p>
                            <pre>
                                {this.state.error.stack}
                            </pre>
                        </>
                    )
                }
                {
                    !this.props.tabletopId ? null : (
                        <>
                            <p>
                                You might be able to return to your current tabletop if the error was triggered by some
                                action you can avoid repeating.  Alternatively, you can return to the tabletops screen.
                            </p>
                            <InputButton type='button' onChange={this.displayCurrentTabletop}>Return to current tabletop</InputButton>
                        </>
                    )
                }
                <InputButton type='button' onChange={this.displayTabletopsScreen}>Go to tabletops screen</InputButton>
            </div>
        ) : (
            this.props.children
        );
    }

}

function mapStoreToProps(store: ReduxStoreType) {
    return {
        tabletopId: getTabletopIdFromStore(store)
    };
}

export default connect(mapStoreToProps)(ErrorBoundaryComponent);