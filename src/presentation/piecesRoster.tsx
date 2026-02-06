import React, {FunctionComponent, SetStateAction, useCallback, useEffect, useMemo, useState} from 'react';
import {useDispatch} from 'react-redux';
import classNames from 'classnames';

import './piecesRoster.scss';

import {
    getPiecesRosterSortString,
    getPiecesRosterValue,
    isNameColumn,
    MiniType,
    ObjectVector3,
    PiecesRosterColumn,
    PiecesRosterColumnType,
    PiecesRosterFractionValue,
    PiecesRosterValue
} from '../util/scenarioUtils';
import PiecesRosterConfiguration from './piecesRosterConfiguration';
import ConfigPanelWrapper from '../container/configPanelWrapper';
import {compareAlphanumeric} from '../util/stringUtils';
import {updateTabletopAction} from '../redux/tabletopReducer';
import InputField from './inputField';
import {
    updateMiniNameAction,
    updateMiniRosterSimpleAction,
    updateMiniRosterValueAction
} from '../redux/scenarioReducer';
import InputButton from './inputButton';
import Tooltip from './tooltip';
import ConfigureButton from './configureButton';

interface MiniTypeWithId extends MiniType {
    miniId: string;
}

type PiecesRosterEditingState = undefined | {
    miniId: string;
    columnId: string;
    value: PiecesRosterValue;
    numberAdjust?: number;
    cumulativeDrag?: number;
    dragDocument?: Document;
};

function shiftFocusColumn(editing: PiecesRosterEditingState, setEditing: (editing: React.SetStateAction<PiecesRosterEditingState>) => void,
                          rows: MiniTypeWithId[], columns: ColumnDetails[],
                          dRow: number, dColumn: number,
                          minis: {[p: string]: MiniType }) {
    if (!editing) {
        return;
    }
    const rowIndex = rows.findIndex((row) => (row.miniId === editing.miniId)) + dRow;
    let colIndex = columns.findIndex((col) => (col.id === editing.columnId)) + dColumn;
    while (dColumn !== 0 && colIndex >= 0 && colIndex < columns.length && columns[colIndex].rosterColumn.type === PiecesRosterColumnType.INTRINSIC) {
        colIndex += dColumn;
    }
    if (rowIndex >= 0 && rowIndex < rows.length && colIndex >= 0 && colIndex < columns.length) {
        const nextMini = rows[rowIndex];
        const nextColumn = columns[colIndex];
        setEditing(() => {
            return {miniId: nextMini.miniId, columnId: nextColumn.id, value: getPiecesRosterValue(nextColumn.rosterColumn, nextMini, minis)};
        })
    }
}

interface PiecesRosterCellProps {
    mini: MiniTypeWithId;
    minis: {[miniId: string]: MiniType};
    editing: PiecesRosterEditingState;
    setEditing(editing: SetStateAction<PiecesRosterEditingState>): void;
    column: ColumnDetails;
    cancelAction(): void;
    okSameColumn(event: React.KeyboardEvent): void;
    okSameRow(event: React.KeyboardEvent): void;
    focusCamera: (position: ObjectVector3) => void;
    readOnly: boolean;
    piecesRosterSimple: boolean;
}

const EditablePiecesRosterCell: FunctionComponent<PiecesRosterCellProps> = ({mini, minis, editing, setEditing, column,
                                                                                cancelAction, okSameColumn, okSameRow,
                                                                                focusCamera, readOnly, piecesRosterSimple}) => {
    const piecesRosterColumn = column.rosterColumn;
    const isEditing = editing !== undefined;
    const numberAdjustPointerDown = useCallback((evt: React.PointerEvent) => {
        if (evt.isPrimary && isEditing) {
            evt.preventDefault();
            const dragDocument = evt.currentTarget.ownerDocument!;
            setEditing((editing) => (
                editing === undefined ? undefined : {
                    ...editing, dragDocument, cumulativeDrag: 0,
                    numberAdjust: editing.numberAdjust === undefined ? 0 : editing.numberAdjust
                }
            ));
        }
    }, [isEditing, setEditing]);
    const onChangeSimple = useCallback((value: PiecesRosterValue) => {
        setEditing((editing) => (editing === undefined ? undefined : {
            ...editing, value, numberAdjust: undefined, cumulativeDrag: undefined, dragDocument: undefined
        }));
    }, [setEditing]);
    const currentValue = getPiecesRosterValue(piecesRosterColumn, mini, minis);
    const startEditing = useCallback(() => {
        if (!readOnly) {
            setEditing({columnId: column.id, miniId: mini.miniId, value: currentValue})
        }
    }, [readOnly, setEditing, column, mini, currentValue]);
    if (piecesRosterSimple && piecesRosterColumn.type !== PiecesRosterColumnType.INTRINSIC) {
        return <td className='disabled'/>;
    }
    if (editing && column.id === editing.columnId && mini.miniId === editing.miniId) {
        let fieldValue: any = editing.value;
        let fieldType: any = 'number';
        let className = 'number';
        let onChange = onChangeSimple;
        switch (piecesRosterColumn.type) {
            case PiecesRosterColumnType.INTRINSIC: // Name field
            case PiecesRosterColumnType.STRING:
                fieldType = 'text';
                className = '';
                break;
            case PiecesRosterColumnType.BONUS:
                fieldValue = +fieldValue;
                break;
            case PiecesRosterColumnType.FRACTION:
                const fraction = editing.value as PiecesRosterFractionValue;
                const {numerator, denominator} = fraction;
                const isNumerator = (column.subColumn === 1);
                fieldValue = (!isNumerator || numerator === undefined) ? denominator : numerator;
                className = isNumerator ? 'numerator' : 'denominator';
                onChange = (newValue: PiecesRosterValue) => {
                    if (isNumerator) {
                        onChangeSimple({...fraction, numerator: newValue as number});
                    } else {
                        const newDenominator = newValue as number;
                        const {numerator: currentNumerator, denominator: currentDenominator} = currentValue as PiecesRosterFractionValue;
                        const newNumerator = (currentDenominator === 0 && currentNumerator !== undefined)
                            ? newDenominator + currentNumerator
                            : (newDenominator === 0 && currentNumerator !== undefined)
                                ? currentNumerator - currentDenominator
                                : currentNumerator;
                        onChangeSimple({numerator: newNumerator, denominator: newDenominator});
                    }
                };
                break;
        }
        if (editing.numberAdjust !== undefined) {
            fieldValue = fieldValue + editing.numberAdjust;
        }
        return (
            <td className={className}>
                {
                    editing.numberAdjust === undefined ? null : (
                        <span className='numberAdjust'>
                            {fieldValue - editing.numberAdjust} {editing.numberAdjust < 0 ? '-' : '+'} {Math.abs(editing.numberAdjust)} =
                        </span>
                    )
                }
                <div className={classNames('editingInput', {numberInput: fieldType === 'number'})}>
                    <InputField type={fieldType} value={fieldValue}
                                focus={true} select={true} onChange={onChange}
                                specialKeys={{Escape: cancelAction, Esc: cancelAction,
                                    Return: okSameColumn, Enter: okSameColumn, Tab: okSameRow}}
                    />
                    {
                        fieldType !== 'number' ? null : (
                            <Tooltip className='numberAdjustIcon' tooltip='Drag up or down to quickly adjust the value.'
                                     disabled={editing.numberAdjust !== undefined}
                            >
                                <span className='material-icons' onPointerDown={numberAdjustPointerDown}>
                                    swap_vertical
                                </span>
                            </Tooltip>
                        )
                    }
                </div>
            </td>
        );
    } else {
        let tdClassName = '';
        if (column.rosterColumn.gmOnly) {
            tdClassName = 'gmOnly';
        }
        switch (piecesRosterColumn.type) {
            case PiecesRosterColumnType.INTRINSIC:
                return (piecesRosterColumn.name === 'Focus') ? (
                    <td className={tdClassName}>
                        <span className='focus material-icons' onClick={() => {focusCamera(mini.position)}}>visibility</span>
                    </td>
                ) : (piecesRosterColumn.name === 'Name') ? (
                    <td className={tdClassName + ' editable'} onClick={startEditing}>{currentValue}</td>
                ) : (
                    <td className={tdClassName}>{currentValue}</td>
                );
            case PiecesRosterColumnType.FRACTION:
                let {numerator, denominator} = currentValue as PiecesRosterFractionValue;
                const isNumerator = (column.subColumn === 1);
                return isNumerator ? (
                    numerator === undefined ? (
                        <td className={tdClassName + ' editable numerator unedited'} onClick={startEditing}>
                            <Tooltip tooltip='The numerator will automatically update to stay at 100% until it is edited manually.'>
                                {denominator}
                            </Tooltip>
                        </td>
                    ) : (
                        <td className={tdClassName + ' editable numerator'} onClick={startEditing}>{numerator}</td>
                    )
                ) : (
                    <td className={tdClassName + ' editable denominator'} onClick={startEditing}>{denominator}</td>
                );
            default:
                return (
                    <td className={classNames(tdClassName, 'editable', {
                        number: piecesRosterColumn.type !== PiecesRosterColumnType.STRING
                    })} onClick={startEditing}>{currentValue}</td>
                );
        }
    }
};

function sortMiniIds(miniIds: string[], minis: {[miniId: string]: MiniType}, columnKeys: {[id: string]: ColumnDetails}, sortBy: SortByState): string[] {
    let result = miniIds;
    const hasName = sortBy.find((sort) => (columnKeys[sort.id] && isNameColumn(columnKeys[sort.id].rosterColumn)));
    if (!hasName) {
        // Always use name ascending as the tie-breaker.
        result = result.sort((id1, id2) => (compareAlphanumeric(minis[id1].name, minis[id2].name)));
    }
    for (let sort of sortBy) {
        const column = columnKeys[sort.id];
        if (!column) {
            // Column has been deleted or is hidden
            continue;
        }
        const sortKey = column.sortKey;
        if (!sortKey) {
            throw new Error('No sort key on sorted column ' + JSON.stringify(column));
        }
        result = result.sort((id1, id2) => (
            (sort.desc ? -1 : 1) * compareAlphanumeric(sortKey(minis[id1]), sortKey(minis[id2]))
        ));
    }
    return result;
}

interface ColumnDetails {
    id: string;
    header: string;
    rosterColumn: PiecesRosterColumn;
    sortKey?: (mini: MiniType) => string;
    colSpan?: number;
    subColumn?: number;
}

type SortByState = {id: string, desc: boolean}[];

interface PiecesRosterProps {
    minis: { [key: string]: MiniType };
    piecesRosterColumns: PiecesRosterColumn[];
    playerView: boolean;
    focusCamera: (position: ObjectVector3) => void;
    readOnly: boolean;
}

const PiecesRoster: FunctionComponent<PiecesRosterProps> = ({minis, piecesRosterColumns, playerView, focusCamera, readOnly}) => {
    const dispatch = useDispatch();
    const columns = useMemo(() => {
        const columns: ColumnDetails[] = [];
        for (let column of piecesRosterColumns) {
            if (!playerView || !column.gmOnly) {
                const isFraction = (column.type === PiecesRosterColumnType.FRACTION);
                columns.push({
                    id: column.id, header: column.name, rosterColumn: column,
                    sortKey: (mini) => (getPiecesRosterSortString(column, mini, minis)),
                    colSpan: isFraction ? 2 : undefined, subColumn: isFraction ? 1 : undefined
                });
                if (isFraction) {
                    columns.push({
                        id: column.id + '-1', header: column.name, rosterColumn: column, subColumn: 2
                    });
                }
            }
        }
        return columns;
    }, [minis, playerView, piecesRosterColumns]);
    const columnKeys = useMemo(() => (
        columns.reduce((keys: {[id: string]: ColumnDetails}, column) => {
            keys[column.id] = column;
            return keys;
        }, {})
    ), [columns]);
    const nameColumn = piecesRosterColumns.find(isNameColumn);
    const anyCustomColumns = useMemo(() => (
        columns.reduce((any, column) => (any || column.rosterColumn.type !== PiecesRosterColumnType.INTRINSIC), false)
    ), [columns]);
    const [sortBy, setSortBy] = useState<SortByState>(nameColumn ? [{id: nameColumn.id, desc: false}] : []);
    const rows = useMemo(() => (
        sortMiniIds(Object.keys(minis).filter((miniId) => (!playerView || !minis[miniId].gmOnly)), minis, columnKeys, sortBy)
            .map((miniId) => ({...minis[miniId], miniId}))
    ), [minis, playerView, columnKeys, sortBy]);
    const [isConfiguring, setIsConfiguring] = useState(false);
    const [editing, setEditing] = useState<PiecesRosterEditingState>();
    const okAction = useCallback(() => {
        setEditing((editing) => {
            const column = editing ? columns.find((column) => (column.id === editing.columnId)) : undefined;
            if (editing && column) {
                if (column.rosterColumn.type === PiecesRosterColumnType.INTRINSIC) {
                    // Name column
                    dispatch(updateMiniNameAction(editing.miniId, editing.value as string));
                } else {
                    dispatch(updateMiniRosterValueAction(editing.miniId, column.rosterColumn, editing.value));
                }
            }
            return undefined;
        })
    }, [setEditing, columns, dispatch]);
    const cancelAction = useCallback(() => {setEditing(undefined)}, [setEditing]);
    const okSameColumn = useCallback((event: React.KeyboardEvent) => {
        okAction();
        shiftFocusColumn(editing, setEditing, rows, columns, event.shiftKey ? -1 : 1, 0, minis);
    }, [editing, setEditing, rows, columns, minis, okAction]);
    const okSameRow = useCallback((event: React.KeyboardEvent) => {
        okAction();
        if (event.preventDefault) {
            event.preventDefault();
        }
        shiftFocusColumn(editing, setEditing, rows, columns, 0, event.shiftKey ? -1 : 1, minis);
    }, [editing, setEditing, rows, columns, minis, okAction]);
    const dragDocument = editing ? editing.dragDocument : undefined;
    const isDragging = editing ? editing.cumulativeDrag !== undefined : false;
    useEffect(() => {
        if (isDragging && dragDocument) {
            const moveListener = (evt: PointerEvent) => {
                if (evt.isPrimary) {
                    evt.preventDefault();
                    setEditing((editing) => {
                        if (editing && editing.cumulativeDrag !== undefined && editing.numberAdjust !== undefined) {
                            let cumulativeDrag = editing.cumulativeDrag - evt.movementY;
                            const delta = cumulativeDrag < 0 ? Math.ceil(cumulativeDrag / 10) : Math.floor(cumulativeDrag / 10);
                            const numberAdjust = editing.numberAdjust + delta;
                            cumulativeDrag -= delta * 10;
                            return {...editing, numberAdjust, cumulativeDrag};
                        } else {
                            return editing;
                        }
                    })
                }
            };
            const touchCanceller = (evt: TouchEvent) => {
                evt.preventDefault();
            };
            const dragEnd = () => {
                setEditing((editing) => (
                    editing ? {...editing, cumulativeDrag: undefined} : editing
                ))
            };
            dragDocument.addEventListener('pointermove', moveListener);
            dragDocument.addEventListener('pointerup', dragEnd);
            dragDocument.addEventListener('touchmove', touchCanceller, {passive: false});
            return () => {
                dragDocument.removeEventListener('pointermove', moveListener);
                dragDocument.removeEventListener('pointerup', dragEnd);
                dragDocument.removeEventListener('touchmove', touchCanceller);
            }
        } else {
            return undefined;
        }
    }, [isDragging, dragDocument, setEditing]);
    const [piecesRosterColumnsState, setPiecesRosterColumnsState] = useState(piecesRosterColumns);
    const savePiecesRosterColumnsConfig = useCallback(async () => {
        // If gmOnly columns are revealed, need to dispatch existing values from piecesRosterGMValues to players.
        const revealedColumns = piecesRosterColumnsState.filter((column) => (
            columnKeys[column.id] && columnKeys[column.id].rosterColumn.gmOnly && !column.gmOnly
        ));
        for (let column of revealedColumns) {
            for (let miniId of Object.keys(minis)) {
                const mini = minis[miniId];
                if (mini.piecesRosterGMValues && mini.piecesRosterGMValues[column.id]) {
                    dispatch(updateMiniRosterValueAction(miniId, column, mini.piecesRosterGMValues[column.id]));
                }
            }
        }
        // Also update the tabletop column list - the reducer will clean up the mini values for deleted columns or
        // those that have changed between gmOnly and player-visible.
        dispatch(updateTabletopAction({piecesRosterColumns: piecesRosterColumnsState}));
        setIsConfiguring(false);
    }, [piecesRosterColumnsState, setIsConfiguring, columnKeys, dispatch, minis]);
    return isConfiguring ? (
        <ConfigPanelWrapper className='piecesRosterConfigWrapper' onClose={() => {setIsConfiguring(false)}} onSave={savePiecesRosterColumnsConfig}>
            <PiecesRosterConfiguration columns={piecesRosterColumnsState} setColumns={setPiecesRosterColumnsState}/>
        </ConfigPanelWrapper>
    ) : (
        <div className='piecesRoster'>
            <div className='tableWrapper'>
                <table>
                    <thead>
                    {
                        <tr>
                            {anyCustomColumns ? (<th>&nbsp;</th>) : null}
                            {columns.map((column) => {
                                if (column.subColumn && !column.colSpan) {
                                    return null;
                                }
                                const sortIndex = sortBy.findIndex((sort) => (sort.id === column.id));
                                return (
                                    <th
                                        key={column.id}
                                        className={classNames({
                                            sortable: column.sortKey !== undefined,
                                            sorted: sortIndex >= 0,
                                            sortedDesc: sortIndex >= 0 && sortBy[sortIndex].desc,
                                            gmOnly: column.rosterColumn.gmOnly
                                        })}
                                        colSpan={column.colSpan}
                                        onClick={(evt) => {
                                            if (column.sortKey) {
                                                if (sortIndex >= 0) {
                                                    setSortBy([
                                                        ...sortBy.slice(0, sortIndex),
                                                        {id: column.id, desc: !sortBy[sortIndex].desc},
                                                        ...sortBy.slice(sortIndex + 1)
                                                    ])
                                                } else if (evt.shiftKey) {
                                                    setSortBy([{id: column.id, desc: false}, ...sortBy]);
                                                } else {
                                                    setSortBy([{id: column.id, desc: false}]);
                                                }
                                            }
                                        }}
                                    >
                                        {column.header}
                                    </th>
                                );
                            })}
                        </tr>
                    }
                    </thead>
                    <tbody>
                    {
                        rows.map((mini) => {
                            return (
                                <tr key={mini.miniId}>
                                    {
                                        anyCustomColumns ? (
                                            <td>
                                                <Tooltip tooltip='Tick if this mini has no custom column values'>
                                                    <InputField type='checkbox' value={mini.piecesRosterSimple} onChange={() => {
                                                        dispatch(updateMiniRosterSimpleAction(mini.miniId, !mini.piecesRosterSimple))
                                                    }}/>
                                                </Tooltip>
                                            </td>
                                        ) : null
                                    }
                                    {
                                        columns.map((column) => (
                                            <EditablePiecesRosterCell key={column.id} mini={mini} minis={minis}
                                                                      editing={editing} setEditing={setEditing}
                                                                      column={column} cancelAction={cancelAction}
                                                                      okSameColumn={okSameColumn} okSameRow={okSameRow}
                                                                      focusCamera={focusCamera} readOnly={readOnly}
                                                                      piecesRosterSimple={mini.piecesRosterSimple}
                                            />
                                        ))
                                    }
                                </tr>
                            )
                        })
                    }
                    </tbody>
                </table>
            </div>
            {
                !editing ? null : (
                    <div className='editControls'>
                        <InputButton type='button' onChange={cancelAction}>Cancel</InputButton>
                        <InputButton type='button' onChange={okAction}>Ok</InputButton>
                        <InputButton type='button' onChange={() => {okSameColumn({shiftKey: false} as React.KeyboardEvent)}}>
                            <span className='material-icons'>arrow_downward</span>
                        </InputButton>
                        <InputButton type='button' onChange={() => {okSameColumn({shiftKey: true} as React.KeyboardEvent)}}>
                            <span className='material-icons'>arrow_upward</span>
                        </InputButton>
                        <InputButton type='button' onChange={() => {okSameRow({shiftKey: false} as React.KeyboardEvent)}}>
                            <span className='material-icons'>arrow_forward</span>
                        </InputButton>
                        <InputButton type='button' onChange={() => {okSameRow({shiftKey: true} as React.KeyboardEvent)}}>
                            <span className='material-icons'>arrow_back</span>
                        </InputButton>
                    </div>
                )
            }
            {
                playerView ? null : (
                    <ConfigureButton onClick={() => {
                        setIsConfiguring(true);
                    }} />
                )
            }
        </div>
    );
};

export default PiecesRoster;