import * as React from 'react';
import * as PropTypes from 'prop-types';
import * as classNames from 'classnames';
import onClickOutside, {InjectedOnClickOutProps} from 'react-onclickoutside';

import './dropDownMenu.css';

export interface DropDownMenuOption {
    label: string;
    onClick: () => void;
    disabled?: boolean;
}

interface DropDownMenuProps {
    menu: React.ReactElement<any>;
    options: DropDownMenuOption[];
    className?: string;
}

interface DropDownMenuState {
    open: boolean;
}

class DropDownMenu extends React.Component<DropDownMenuProps & InjectedOnClickOutProps, DropDownMenuState> {

    static PropTypes = {
        menu: PropTypes.element.isRequired,
        options: PropTypes.arrayOf(PropTypes.object).isRequired,
        className: PropTypes.string
    };

    private element: HTMLDivElement | null;

    constructor(props: DropDownMenuProps & InjectedOnClickOutProps) {
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
                                    option.onClick();
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