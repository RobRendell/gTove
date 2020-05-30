import React, {FunctionComponent, useMemo} from 'react';
import {Column, useSortBy, useTable} from 'react-table';

import {getVisibilityString, MiniType, ObjectVector3, PieceVisibilityEnum} from '../util/scenarioUtils';

import './piecesRoster.scss';

interface PiecesRosterProps {
    minis: { [key: string]: MiniType };
    playerView: boolean;
    focusCamera: (position: ObjectVector3) => void;
}

const PiecesRoster: FunctionComponent<PiecesRosterProps> = ({minis, playerView, focusCamera}) => {
    const miniIds = useMemo(() => (
        Object.keys(minis)
            .filter((miniId) => (!playerView || !minis[miniId].gmOnly))
    ), [minis, playerView]);
    const columns = useMemo(() => {
        const columns: Array<Column<MiniType>> = [
            {Header: 'Name', accessor: 'name'},
            {
                Header: 'Focus', accessor: 'position', disableSortBy: true,
                Cell: ({value}: {value: ObjectVector3}) => (
                    <span className='focus material-icons'
                          onMouseDown={() => {focusCamera(value)}}
                          onTouchStart={() => {focusCamera(value)}}
                    >visibility</span>
                )
            }
        ];
        if (!playerView) {
            columns.push(
                {
                    Header: 'Visibility', accessor: (mini: MiniType) => (
                        mini.visibility === PieceVisibilityEnum.FOGGED ? (mini.gmOnly ? 'Fog (hide)' : 'Fog (show)')
                            : getVisibilityString(mini.visibility)
                    )
                }
            );
        }
        if (miniIds.find((miniId) => (minis[miniId].locked))) {
            columns.push(
                {Header: 'Locked', accessor: (mini: MiniType) => (mini.locked ? 'Y' : 'N')}
            )
        }
        return columns;
    }, [playerView, minis, focusCamera, miniIds]);
    const data = useMemo(() => (
        // Sort by name, even though the table will too, so ascending by name becomes the natural order
        miniIds
            .sort((id1, id2) => {
                const name1 = minis[id1].name;
                const name2 = minis[id2].name;
                // TODO react-table sorts by something other than <, since this puts numbers before letters but theirs does the opposite.
                return name1 < name2 ? -1 : name1 === name2 ? 0 : 1
            })
            .map((miniId) => (minis[miniId]))
    ), [minis, miniIds]);
    const {
        getTableProps,
        headerGroups,
        getTableBodyProps,
        rows,
        prepareRow
    } = useTable<MiniType>({columns, data, autoResetSortBy: false}, useSortBy);
    return (
        <div className='piecesRoster'>
            <table {...getTableProps()}>
                <thead>
                {
                    headerGroups.map((headerGroup) => (
                        <tr {...headerGroup.getHeaderGroupProps()}>
                            {headerGroup.headers.map(column => (
                                <th {...column.getHeaderProps(column.getSortByToggleProps())}>
                                    {column.render('Header')}
                                    {
                                        !column.isSorted ? null : (
                                            column.isSortedDesc ? (
                                                <span className='material-icons'>expand_less</span>
                                            ) : (
                                                <span className='material-icons'>expand_more</span>
                                            )
                                        )
                                    }
                                </th>
                            ))}
                        </tr>
                    ))
                }
                </thead>
                <tbody {...getTableBodyProps()}>
                {
                    rows.map((row) => {
                        prepareRow(row);
                        return (
                            <tr {...row.getRowProps()}>
                                {
                                    row.cells.map(cell => (
                                        <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
                                    ))
                                }
                            </tr>
                        )
                    })
                }
                </tbody>
            </table>
        </div>
    );
};

export default PiecesRoster;