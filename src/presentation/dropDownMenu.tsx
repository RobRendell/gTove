import * as React from 'react';
import classNames from 'classnames';
import onClickOutside, {InjectedOnClickOutProps} from 'react-onclickoutside';

import './dropDownMenu.scss';

export interface DropDownMenuClickParams {
    showBusySpinner: (show: boolean) => void;
}

export interface DropDownMenuOption<T> {
    label: string;
    onClick: (parameters: DropDownMenuClickParams) => (void | Promise<void | T>);
    disabled?: boolean;
}

interface DropDownMenuProps<T> {
    menu: React.ReactElement<any>;
    options: DropDownMenuOption<T>[];
    className?: string;
    showBusySpinner: (show: boolean) => void;
}

interface DropDownMenuState {
    open: boolean;
}

class DropDownMenu<T> extends React.Component<DropDownMenuProps<T> & InjectedOnClickOutProps, DropDownMenuState> {

    private element: HTMLDivElement | null;

    constructor(props: DropDownMenuProps<T> & InjectedOnClickOutProps) {
        super(props);
        this.state = {
            open: false
        };
    }

    public handleClickOutside() {
        this.setState({open: false});
    }

    render() {
        return (
            <div className={classNames('dropDownMenu', this.props.className)}>
                <div className='menuButton' onClick={(event: React.MouseEvent<HTMLElement>) => {
                    this.setState({open: !this.state.open}, () => {
                        if (this.state.open && this.element) {
                            this.element.scrollIntoView({behavior: 'smooth', block: 'nearest'});
                        }
                    });
                    event.stopPropagation();
                }}>
                    {this.props.menu}
                </div>
                <div className={classNames('menu', {
                    openMenu: this.state.open
                })} ref={(element: HTMLDivElement | null) => {this.element = element;}}>
                    {
                        this.props.options.map((option) => (
                            <div key={option.label} className={classNames('menuItem', {
                                disabled: option.disabled
                            })} onClick={(event: React.MouseEvent<HTMLElement>) => {
                                event.stopPropagation();
                                if (this.state.open && !option.disabled) {
                                    option.onClick({showBusySpinner: this.props.showBusySpinner});
                                    this.setState({open: false});
                                }
                            }}>{option.label}</div>
                        ))
                    }
                </div>
            </div>
        );
    }
}

export default onClickOutside(DropDownMenu);