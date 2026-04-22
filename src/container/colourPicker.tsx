import {FunctionComponent, useCallback, useMemo, useState} from 'react';
import {Color, ColorResult, SketchPicker} from 'react-color';

const defaultSwatches = [
    '#d0021b', '#ffa500', '#f8e71c', '#b8e986',
    '#7ed321', '#417505', '#4a90e2', '#50e3c2',
    '#bd10e0', '#9013fe', '#c77f16', '#8b572a',
    '#ffffff', '#9b9b9b', '#4a4a4a', '#000000'
];

export interface ColourPickerProps {
    disableAlpha?: boolean;
    initialColour: number | string;
    initialAlpha?: number;
    onColourChange: (colour: ColorResult) => void;
    initialSwatches?: string[];
    onSwatchChange?: (swatches: string[], index: number) => void;
}

const ColourPicker: FunctionComponent<ColourPickerProps> = ({disableAlpha, initialColour, initialAlpha, onColourChange, initialSwatches, onSwatchChange}) => {
    const colourInit = useMemo(() => (
        typeof initialColour === 'string' ? initialColour
            : {
                r: (initialColour >> 16) & 0xff,
                g: (initialColour >> 8) & 0xff,
                b: initialColour & 0xff,
                a: initialAlpha
            }
    ), [initialAlpha, initialColour]);
    const [colour, setColour] = useState<Color>(colourInit);
    const [swatches, setSwatches] = useState<string[]>(initialSwatches ?? defaultSwatches);
    const [swatchIndex, setSwatchIndex] = useState(-1);

    const onChange = useCallback((colour: ColorResult, evt?: any) => {
        onColourChange(colour);
        setColour({...colour.rgb});
        if (evt?.target?.title) {
            const swatchIndex = swatches.indexOf(evt.target.title);
            setSwatchIndex((previous) => (previous === swatchIndex ? -1 : swatchIndex));
        } else if (swatchIndex !== -1) {
            setSwatches((previous) => {
                const swatches = [...previous];
                swatches[swatchIndex] = colour.hex;
                onSwatchChange?.(swatches, swatchIndex);
                return swatches;
            })
        }
    }, [onColourChange, onSwatchChange, swatchIndex, swatches]);

    return (
        <SketchPicker color={colour} disableAlpha={disableAlpha || false} presetColors={swatches} onChange={onChange} />
    );
}

export default ColourPicker;