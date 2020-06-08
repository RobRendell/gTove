import React, {FunctionComponent, SetStateAction, useCallback, useMemo, useState} from 'react';
import {useDispatch} from 'react-redux';
import classNames from 'classnames';

import {
    getPiecesRosterSortString,
    getPiecesRosterValue,
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
import {updateMiniRosterValueAction} from '../redux/scenarioReducer';
import InputButton from './inputButton';

import './piecesRoster.scss';

interface MiniTypeWithId extends MiniType {
    miniId: string;
}

type PiecesRosterEditingState = undefined | {miniId: string, columnId: string, value: PiecesRosterValue};

function shiftFocusColumn(editing: PiecesRosterEditingState, setEditing: (editing: React.SetStateAction<PiecesRosterEditingState>) => void,
                          rows: MiniTypeWithId[], columns: ColumnDetails[],
                          dRow: number, dColumn: number,
                          minis: {[p: string]: MiniType }) {
    if (!editing) {
        return;
    }
    const rowIndex = rows.findIndex((row) => (row.miniId === editing.miniId)) + dRow;
    let colIndex = columns.findIndex((col) => (col.id === editing.columnId)) + dColumn;
    while (dColumn !== 0 && colIndex >= 0 && colIndex < columns.length && (
            columns[colIndex].rosterColumn === undefined || columns[colIndex].rosterColumn.type === PiecesRosterColumnType.INTRINSIC)) {
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
}

const EditablePiecesRosterCell: FunctionComponent<PiecesRosterCellProps> = ({mini, minis, editing, setEditing, column, cancelAction, okSameColumn, okSameRow, focusCamera}) => {
    const piecesRosterColumn = column.rosterColumn;
    const value = getPiecesRosterValue(piecesRosterColumn, mini, minis);
    if (piecesRosterColumn.type === PiecesRosterColumnType.INTRINSIC) {
        return (piecesRosterColumn.name === 'Focus') ? (
            <td>
                <span className='focus material-icons' onClick={() => {focusCamera(mini.position)}}>visibility</span>
            </td>
        ) : (
            <td>{value}</td>
        );
    }
    if (editing && column.id === editing.columnId && mini.miniId === editing.miniId) {
        if (piecesRosterColumn.type === PiecesRosterColumnType.FRACTION) {
            const fraction = value as PiecesRosterFractionValue;
            const {numerator, denominator} = fraction;
            const isNumerator = (column.subColumn === 1);
            return (
                <td className={isNumerator ? 'numerator' : 'denominator'}>
                    <InputField type='number' initialValue={!isNumerator || numerator === undefined ? denominator : numerator}
                                focus={true} select={true}
                                onChange={(value: number) => {
                                    setEditing({...editing, value: isNumerator ? {...fraction, numerator: value} : {...fraction, denominator: value}});
                                }}
                                specialKeys={{Escape: cancelAction, Esc: cancelAction,
                                    Return: okSameColumn, Enter: okSameColumn, Tab: okSameRow}}
                    />
                </td>
            );
        } else {
            const fieldType = (piecesRosterColumn.type === PiecesRosterColumnType.STRING) ? 'text' : 'number';
            const fieldValue: any = (piecesRosterColumn.type === PiecesRosterColumnType.BONUS) ? (value === undefined ? 0 : +value) : value;
            return (
                <td className={classNames({number: piecesRosterColumn.type !== PiecesRosterColumnType.STRING})}>
                    <InputField type={fieldType} initialValue={fieldValue} focus={true} select={true}
                                onChange={(value: PiecesRosterValue) => {
                                    setEditing({...editing, value});
                                }}
                                specialKeys={{Escape: cancelAction, Esc: cancelAction,
                                    Return: okSameColumn, Enter: okSameColumn, Tab: okSameRow}}
                    />
                </td>
            );
        }
    } else {
        if (piecesRosterColumn.type === PiecesRosterColumnType.FRACTION) {
            let {numerator, denominator} = value as PiecesRosterFractionValue;
            const isNumerator = (column.subColumn === 1);
            return isNumerator ? (
                numerator === undefined ? (
                    <td className='editable numerator unedited' onClick={() => {
                        setEditing({columnId: column.id, miniId: mini.miniId, value})
                    }}>
                        <Tooltip tooltip='The numerator will automatically update to stay at 100% until it is edited manually.'>
                            {denominator}
                        </Tooltip>
                    </td>
                ) : (
                    <td className='editable numerator' onClick={() => {
                        setEditing({columnId: column.id, miniId: mini.miniId, value})
                    }}>{numerator}</td>
                )
            ) : (
                <td className='editable denominator' onClick={() => {
                    setEditing({columnId: column.id, miniId: mini.miniId, value})
                }}>{denominator}</td>
            );
        } else {
            return (
                <td className={classNames('editable', {
                    number: piecesRosterColumn.type !== PiecesRosterColumnType.STRING
                })} onClick={() => {
                    setEditing({columnId: column.id, miniId: mini.miniId, value})
                }}>{value}</td>
            );
        }
    }
};

function isNameColumn(column: PiecesRosterColumn) {
    return column.type === PiecesRosterColumnType.INTRINSIC && column.name === 'Name';
}

function sortMiniIds(miniIds: string[], minis: {[miniId: string]: MiniType}, columnKeys: {[id: string]: ColumnDetails}, sortBy: SortByState): string[] {
    let result = miniIds;
    const hasName = sortBy.find((sort) => (isNameColumn(columnKeys[sort.id].rosterColumn)));
    if (!hasName) {
        // Always use name ascending as the tie-breaker.
        result = result.sort((id1, id2) => (compareAlphanumeric(minis[id1].name, minis[id2].name)));
    }
    for (let sort of sortBy) {
        const column = columnKeys[sort.id];
        if (!column) {
            // Column has been deleted
            continue;
        }
        const sortKey = column.sortKey;
        if (!sortKey) {
            throw new Error('No sort key on sorted column' + JSON.stringify(column));
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
}

const PiecesRoster: FunctionComponent<PiecesRosterProps> = ({minis, piecesRosterColumns, playerView, focusCamera}) => {
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
        columns.reduce((keys, column) => {
            keys[column.id] = column;
            return keys;
        }, {})
    ), [columns]);
    const nameColumn = piecesRosterColumns.find(isNameColumn);
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
                dispatch(updateMiniRosterValueAction(editing.miniId, column.rosterColumn, editing.value));
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
    const [piecesRosterColumnsState, setPiecesRosterColumnsState] = useState(piecesRosterColumns);
    return isConfiguring ? (
        <ConfigPanelWrapper className='piecesRosterConfigWrapper' onClose={() => {setIsConfiguring(false)}} onSave={async () => {
            dispatch(updateTabletopAction({piecesRosterColumns: piecesRosterColumnsState}));
            setIsConfiguring(false);
        }}>
            <PiecesRosterConfiguration columns={piecesRosterColumnsState} setColumns={setPiecesRosterColumnsState}/>
        </ConfigPanelWrapper>
    ) : (
        <div className='piecesRoster'>
            <div className='tableWrapper'>
                <table>
                    <thead>
                    {
                        <tr>
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
                                            sortedDesc: sortIndex >= 0 && sortBy[sortIndex].desc
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
                                        columns.map((column) => (
                                            <EditablePiecesRosterCell key={column.id} mini={mini} minis={minis}
                                                                      editing={editing} setEditing={setEditing}
                                                                      column={column} cancelAction={cancelAction}
                                                                      okSameColumn={okSameColumn} okSameRow={okSameRow}
                                                                      focusCamera={focusCamera}
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
                    <div className='configControl'>
                        <span className='material-icons' onClick={() => {
                            setIsConfiguring(true);
                        }}>settings</span>
                    </div>
                )
            }
        </div>
    );
};

export default PiecesRoster;