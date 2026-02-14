import './googleSignInButton.scss';

import classNames from 'classnames';
import {Component} from 'react';

interface GoogleSignInButtonProps {
    onClick: () => void;
    disabled?: boolean;
}

export default class GoogleSignInButton extends Component<GoogleSignInButtonProps> {

    render() {
        return (
            <div
                className={classNames('googleSignInButton', {disabled: this.props.disabled})}
                onClick={this.props.onClick}
                title={this.props.disabled ? 'Waiting for Google API to initialise...' : 'Sign in with Google'}
            />
        );
    }

}