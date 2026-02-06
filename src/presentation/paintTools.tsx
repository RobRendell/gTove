import {FunctionComponent, useState} from 'react';
import * as THREE from 'three';

import InputButton from './inputButton';
import ColourPicker from './colourPicker';
import {getColourHex, GRID_COLOUR} from '../util/scenarioUtils';
import InputField from './inputField';
import Tooltip from './tooltip';

import './paintTools.scss';

export enum PaintToolEnum {
    NONE = 'NONE',
    PAINT_BRUSH = 'PAINT_BRUSH',
    LINE_TOOL = 'LINE_TOOL',
    ERASER = 'ERASER',
    CLEAR = 'CLEAR'
}

const showTools: Record<string, Record<PaintToolEnum, boolean>> = {
    sizeSlider:  {
        [PaintToolEnum.PAINT_BRUSH]: true,
        [PaintToolEnum.LINE_TOOL]: true,
        [PaintToolEnum.ERASER]: true} as Record<PaintToolEnum, boolean>,
    colourPicker: {
        [PaintToolEnum.PAINT_BRUSH]: true,
        [PaintToolEnum.LINE_TOOL]: true} as Record<PaintToolEnum, boolean>
};

interface ToolRenderData {
    icon: string;
    tooltip: string;
}

const toolRenderData: Record<PaintToolEnum, ToolRenderData> = {
    [PaintToolEnum.NONE]: {icon: 'pan_tool', tooltip: 'No tool - interact with the tabletop normally.'},
    [PaintToolEnum.PAINT_BRUSH]: {icon: 'brush', tooltip: 'Paint tool - paint a line on a map.'},
    [PaintToolEnum.LINE_TOOL]: {icon: 'straighten', tooltip: 'Line tool - paint a straight line on a map.'},
    [PaintToolEnum.ERASER]: {icon: 'highlight_off', tooltip: 'Erase tool - erase painting on a map with a brush.'},
    [PaintToolEnum.CLEAR]: {icon: 'delete', tooltip: 'Clear tool - clear all painting on a map.'}
};

export interface PaintState {
    open: boolean;
    selected: PaintToolEnum;
    brushColour: string;
    brushSize: number;
    operationId?: string;
    toolPositionStart?: THREE.Vector3;
    toolPosition?: THREE.Vector3;
    toolMapId?: string;
}

export const initialPaintState: PaintState = {
    open: false,
    selected: PaintToolEnum.NONE,
    brushColour: '#000000',
    brushSize: 0.2
};

interface PaintToolsProps {
    paintState: PaintState;
    updatePaintState: (state: Partial<PaintState>) => void;
    paintToolColourSwatches?: string[];
    updatePaintToolColourSwatches: (swatches: string[]) => void;
}

const PaintTools: FunctionComponent<PaintToolsProps> = ({paintState, updatePaintState, paintToolColourSwatches, updatePaintToolColourSwatches}) => {
    const [showColourPicker, setShowColourPicker] = useState(false);
    return (
        <div className='paintTools'>
            {
                Object.keys(PaintToolEnum).map((type) => (
                    <InputButton key={type} type='radio' name='paintTool'
                                 selected={paintState.selected === type}
                                 onChange={() => {updatePaintState({selected: type as PaintToolEnum})}}>
                        <Tooltip tooltip={toolRenderData[type as PaintToolEnum].tooltip}>
                            <span className='material-icons'>{toolRenderData[type as PaintToolEnum].icon}</span>
                        </Tooltip>
                    </InputButton>
                ))
            }
            <hr/>
            <p>{toolRenderData[paintState.selected].tooltip}</p>
            {
                !showTools.sizeSlider[paintState.selected] ? null : (
                    <InputField heading='Size' type='range' showValue={true}
                                initialValue={paintState.brushSize} minValue={0.05} maxValue={2.0} step={0.05}
                                onChange={(value) => {updatePaintState({brushSize: value})}}
                    />
                )
            }
            {
                !showTools.colourPicker[paintState.selected] ? null : (
                    <div className='brushColour'>
                        <span>Colour</span>
                        <Tooltip className='colourSwatch' tooltip='Change brush colour'>
                            <div onClick={() => {setShowColourPicker(!showColourPicker)}}>
                                <div style={{backgroundColor: paintState.brushColour}}/>
                            </div>
                        </Tooltip>
                        {
                            !showColourPicker ? null : (
                                <ColourPicker initialColour={getColourHex(paintState.brushColour as GRID_COLOUR)}
                                              onColourChange={(result) => {
                                                  const brushColour = result.rgb.a !== undefined && result.rgb.a !== 1
                                                      ? result.hex + Math.floor(result.rgb.a * 255).toString(16) : result.hex;
                                                  updatePaintState({brushColour});
                                              }}
                                              initialSwatches={paintToolColourSwatches}
                                              onSwatchChange={updatePaintToolColourSwatches}
                                />
                            )
                        }
                    </div>
                )
            }
        </div>
    );
};

export default PaintTools;