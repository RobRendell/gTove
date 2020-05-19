import * as React from 'react';
import * as PropTypes from 'prop-types';
import classNames from 'classnames';

import Tooltip from './tooltip';

import './inputButton.scss';

interface InputButtonProps {
    onChange: (event?: React.ChangeEvent<HTMLInputElement>) => void;
    type: 'checkbox' | 'button' | 'file';
    className?: string;
    selected?: boolean;
    multiple?: boolean;
    tooltip?: string;
    disabled?: boolean;
    fillWidth?: boolean;
}

class InputButton extends React.Component<InputButtonProps> {

    static propTypes = {
        onChange: PropTypes.func.isRequired,
        type: PropTypes.string,
        selected: PropTypes.bool,
        multiple: PropTypes.bool,
        title: PropTypes.string,
        disabled: PropTypes.bool
    };

    render() {
        const handler = (this.props.type === 'button')
            ? {
                onClick: () => {
                    this.props.onChange();
                }
            }
            : {
                onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                    this.props.onChange(event);
                }
            };

        return (
            <label className={classNames('button', this.props.type, {fillWidth: this.props.fillWidth, disabled: this.props.disabled})}>
                <input
                    type={this.props.type}
                    checked={this.props.selected}
                    multiple={this.props.multiple}
                    disabled={this.props.disabled}
                    {...handler}
                />
                <Tooltip className={this.props.className} tooltip={this.props.tooltip}>{this.props.children}</Tooltip>
            </label>
        );
    }
}

export default InputButton;