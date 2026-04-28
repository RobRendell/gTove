import './errorBoundaryDisplayComponent.scss';

import copy from 'copy-to-clipboard';
import {FunctionComponent, useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {useToast} from '../hooks/useToast';
import {useToggleState} from '../hooks/useToggleState';
import {setTabletopIdAction} from '../redux/locationReducer';
import {getTabletopIdFromStore} from '../redux/mainReducer';
import {appVersion} from '../util/appVersion';
import InputButton from './inputButton';

interface ErrorBoundaryDisplayComponentProps {
    error: Error;
    clearError: () => void;
}

const ErrorBoundaryDisplayComponent: FunctionComponent<ErrorBoundaryDisplayComponentProps> = ({error, clearError}) => {
    const dispatch = useDispatch();
    const tabletopId = useSelector(getTabletopIdFromStore);
    const toast = useToast();

    const [showError, toggleShowError] = useToggleState(false);

    const copyErrorToClipboard = useCallback(() => {
        const errorText = `gTove version ${appVersion.numCommits} - ${error.stack}`;
        copy(errorText);
        console.log(errorText);
        toast('Error details copied to clipboard.');
    }, [error.stack, toast]);
    
    const displayTabletopsScreen = useCallback(() => {
        dispatch(setTabletopIdAction());
        clearError();
    }, [clearError, dispatch]);

    return (
        <div className='errorBoundaryDisplayComponent'>
            <h1>An error occurred!</h1>
            <p>
                gTove has encountered an error. Sorry about that.
            </p>
            <InputButton type='button' onChange={copyErrorToClipboard}>Copy error to clipboard</InputButton>
            <InputButton type='button' onChange={toggleShowError}>{showError ? 'Hide' : 'Show'} error details</InputButton>
            {
                !showError ? null : (
                    <pre>
                        gTove version {appVersion.numCommits} - {error.stack}
                    </pre>
                )
            }
            {
                !tabletopId ? null : (
                    <>
                        <p>
                            You might be able to return to your current tabletop if the error was triggered by some
                            action you can avoid repeating.  Alternatively, you can return to the tabletops screen.
                        </p>
                        <InputButton type='button' onChange={clearError}>Return to current tabletop</InputButton>
                    </>
                )
            }
            <InputButton type='button' onChange={displayTabletopsScreen}>Go to tabletops screen</InputButton>
        </div>
    );
}

export default ErrorBoundaryDisplayComponent;