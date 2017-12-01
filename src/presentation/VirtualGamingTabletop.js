import React, {Component} from 'react';
import classNames from 'classnames';

import MapViewComponent from './MapViewComponent';
import {signOutFromGoogleAPI} from '../util/googleAPIUtils';
import BrowseMapsComponent from '../container/BrowseMapsComponent';

import './VirtualGamingTabletop.css';

class VirtualGamingTabletop extends Component {

    static GAMING_TABLETOP = 0;
    static MAP_SCREEN = 1;

    static buttons = [
        {label: 'Maps', state: VirtualGamingTabletop.MAP_SCREEN}
        // Minis
        // Templates
        // Scenarios
        // Game
    ];

    constructor(props) {
        super(props);
        this.onBack = this.onBack.bind(this);
        this.state = {
            panelOpen: false,
            currentPage: VirtualGamingTabletop.GAMING_TABLETOP,
            currentScenario: null
        }
    }

    onBack() {
        this.setState({currentPage: VirtualGamingTabletop.GAMING_TABLETOP});
    }

    renderControlPanelAndMap() {
        return (
            <div className='controlFrame'>
                {this.state.panelOpen ? null : (
                    <div className='menuControl material-icons' onClick={() => {
                        this.setState({panelOpen: true});
                    }}>menu</div>
                )}
                <div className={classNames('controlPanel', {
                    open: this.state.panelOpen
                })}>
                    <div className='material-icons' onClick={() => {
                        this.setState({panelOpen: false});
                    }}>menu</div>
                    <button onClick={() => {signOutFromGoogleAPI()}}>Sign Out</button>
                    {
                        VirtualGamingTabletop.buttons.map((buttonData) => (
                            <button key={buttonData.label} onClick={() => {
                                this.setState({currentPage: buttonData.state, panelOpen: false});
                            }}>{buttonData.label}</button>
                        ))
                    }
                </div>
                <div className='mainArea'>
                    <MapViewComponent
                        scenario={this.state.currentScenario}
                    />
                </div>
            </div>
        );
    }

    render() {
        switch (this.state.currentPage) {
            case VirtualGamingTabletop.GAMING_TABLETOP:
                return this.renderControlPanelAndMap();
            case VirtualGamingTabletop.MAP_SCREEN:
                return <BrowseMapsComponent onBack={this.onBack} onPickMap={(mapMetadata) => {
                    this.setState({
                        currentScenario: {mapMetadata},
                        currentPage: VirtualGamingTabletop.GAMING_TABLETOP
                    });
                }}/>;
            default:
                return null;
        }
    }
}

export default VirtualGamingTabletop;