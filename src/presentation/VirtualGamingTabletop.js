import React, {Component} from 'react';
import classNames from 'classnames';
import {connect} from 'react-redux';
import {v4} from 'uuid';

import MapViewComponent from './MapViewComponent';
import {signOutFromGoogleAPI} from '../util/googleAPIUtils';
import BrowseFilesComponent from '../container/BrowseFilesComponent';
import * as constants from '../util/constants';
import MapEditor from './MapEditor';
import {addMapAction, addMiniAction} from '../redux/scenarioReducer';

import './VirtualGamingTabletop.css';

class VirtualGamingTabletop extends Component {

    static GAMING_TABLETOP = 0;
    static MAP_SCREEN = 1;
    static MINIS_SCREEN = 2;

    static buttons = [
        {label: 'Maps', state: VirtualGamingTabletop.MAP_SCREEN},
        {label: 'Minis', state: VirtualGamingTabletop.MINIS_SCREEN}
        // Templates
        // Scenarios
        // Game
    ];

    constructor(props) {
        super(props);
        this.onBack = this.onBack.bind(this);
        this.state = {
            panelOpen: false,
            currentPage: VirtualGamingTabletop.GAMING_TABLETOP
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
                    }}>menu
                    </div>
                    <button onClick={() => {
                        signOutFromGoogleAPI()
                    }}>Sign Out
                    </button>
                    {
                        VirtualGamingTabletop.buttons.map((buttonData) => (
                            <button key={buttonData.label} onClick={() => {
                                this.setState({currentPage: buttonData.state, panelOpen: false});
                            }}>{buttonData.label}</button>
                        ))
                    }
                </div>
                <div className='mainArea'>
                    <MapViewComponent/>
                </div>
            </div>
        );
    }

    render() {
        switch (this.state.currentPage) {
            case VirtualGamingTabletop.GAMING_TABLETOP:
                return this.renderControlPanelAndMap();
            case VirtualGamingTabletop.MAP_SCREEN:
                return <BrowseFilesComponent
                    topDirectory={constants.FOLDER_MAP}
                    onBack={this.onBack}
                    onPickFile={(mapMetadata) => {
                        this.props.dispatch(addMapAction(v4(), mapMetadata));
                        this.setState({currentPage: VirtualGamingTabletop.GAMING_TABLETOP});
                    }}
                    editorComponent={MapEditor}
                />;
            case VirtualGamingTabletop.MINIS_SCREEN:
                return <BrowseFilesComponent
                    topDirectory={constants.FOLDER_MINI}
                    onBack={this.onBack}
                    onPickFile={(miniMetadata) => {
                        this.props.dispatch(addMiniAction(v4(), miniMetadata));
                        this.setState({currentPage: VirtualGamingTabletop.GAMING_TABLETOP});
                    }}
                    editorComponent={MapEditor} // For now there's no difference
                />;
            default:
                return null;
        }
    }
}

export default connect()(VirtualGamingTabletop);