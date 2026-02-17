import {FunctionComponent, memo, useMemo} from 'react';
import {Vector3} from 'three';

import {getPiecesRosterDisplayValue, isNameColumn, PiecesRosterColumn, PiecesRosterValues} from '../util/scenarioUtils';
import LabelSprite from './labelSprite';

interface RosterColumnValuesLabelProps {
    label: string;
    labelSize: number;
    labelColour?: string;
    renderOrder: number;
    piecesRosterColumns: PiecesRosterColumn[];
    piecesRosterValues?: PiecesRosterValues;
    position: Vector3;
    inverseScale?: Vector3;
    maxWidth?: number;
    paddingBottom?: number;
}

const RosterColumnValuesLabel: FunctionComponent<RosterColumnValuesLabelProps> = memo(({
                                                                                           label,
                                                                                           labelSize,
                                                                                           labelColour,
                                                                                           renderOrder,
                                                                                           piecesRosterColumns,
                                                                                           piecesRosterValues,
                                                                                           position,
                                                                                           inverseScale,
                                                                                           maxWidth,
                                                                                           paddingBottom
                                                                                       }) => {
    const fullText = useMemo(() => (
        piecesRosterColumns
            .map((column) => (
                isNameColumn(column) ? label : getPiecesRosterDisplayValue(column, piecesRosterValues)
            ))
            .filter((text) => (!!text.trim()))
            .join('\n')
    ), [label, piecesRosterColumns, piecesRosterValues]);

    return !fullText ? null : (
        <LabelSprite label={fullText} labelSize={labelSize} position={position}
                     renderOrder={renderOrder} fillColour={labelColour}
                     inverseScale={inverseScale} maxWidth={maxWidth}
                     paddingBottom={paddingBottom}
        />
    )
});

export default RosterColumnValuesLabel;