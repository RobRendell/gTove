import React, {Component} from 'react';
import {ColorState, RGBColor, SketchPicker} from 'react-color';

interface ColourPickerProps {
    disableAlpha?: boolean;
    initialColour: number;
    initialAlpha?: number;
    onColourChange: (colour: ColorState) => void;
    initialSwatches?: string[];
    onSwatchChange?: (swatches: string[], index: number) => void;
}

interface ColourPickerState {
    colour: RGBColor;
    swatches: string[];
    swatchIndex: number
}

export default class ColourPicker extends Component<ColourPickerProps, ColourPickerState> {

    constructor(props: ColourPickerProps) {
        super(props);
        const colour = {
            r: (props.initialColour >> 16) & 0xff,
            g: (props.initialColour >> 8) & 0xff,
            b: props.initialColour & 0xff,
            a: props.initialAlpha
        };

        this.state = {
            colour,
            swatches: props.initialSwatches || [
                '#d0021b', '#ffa500', '#f8e71c', '#b8e986',
                '#7ed321', '#417505', '#4a90e2', '#50e3c2',
                '#bd10e0', '#9013fe', '#c77f16', '#8b572a',
                '#ffffff', '#9b9b9b', '#4a4a4a', '#000000'
            ],
            swatchIndex: -1
        };
    }

    render() {
        return (
            <SketchPicker
                color={this.state.colour} disableAlpha={this.props.disableAlpha || false} presetColors={this.state.swatches}
                onChange={(colour, evt?: any) => {
                    this.props.onColourChange(colour);
                    this.setState({colour: {...colour.rgb}});
                    if (evt && evt.target && evt.target.title) {
                        const swatchIndex = this.state.swatches.indexOf(evt.target.title);
                        this.setState({swatchIndex: (swatchIndex === this.state.swatchIndex) ? -1 : swatchIndex});
                    } else if (this.state.swatchIndex !== -1) {
                        const swatches = [...this.state.swatches];
                        swatches[this.state.swatchIndex] = colour.hex;
                        this.setState({swatches});
                        this.props.onSwatchChange && this.props.onSwatchChange(swatches, this.state.swatchIndex);
                    }
                }}
            />
        );
    }
}