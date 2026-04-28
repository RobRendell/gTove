import {Component, ComponentType, PropsWithChildren} from 'react';

interface ErrorBoundaryContainerProps extends PropsWithChildren {
    errorDisplay: ComponentType<{error: Error; clearError: () => void}>;
}

interface ErrorBoundaryContainerState {
    error?: Error;
}

class ErrorBoundaryContainer extends Component<ErrorBoundaryContainerProps, ErrorBoundaryContainerState> {

    constructor(props: ErrorBoundaryContainerProps) {
        super(props);
        this.state = {};
    }

    // There is no FunctionComponent equivalent of getDerivedStateFromError, so error boundaries must be class-based.
    static getDerivedStateFromError(error: Error) {
        return {error};
    }

    clearError = () => {
        this.setState({error: undefined});
    }

    render() {
        const ErrorDisplay = this.props.errorDisplay;
        return this.state.error ? (
            <ErrorDisplay error={this.state.error} clearError={this.clearError} />
        ) : (
            this.props.children
        );
    }

}

export default ErrorBoundaryContainer;