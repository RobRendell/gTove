import React, {FunctionComponent, useMemo} from 'react';
import {useSortBy, useTable} from 'react-table';

import {getVisibilityString, MiniType, PieceVisibilityEnum} from '../util/scenarioUtils';

import './piecesTable.scss';

interface PiecesTableProps {
    minis: { [key: string]: MiniType };
}

const PiecesTable: FunctionComponent<PiecesTableProps> = (props) => {
    const columns = useMemo(() => {
        const columns = [
            {Header: 'Name', accessor: (mini: MiniType) => (mini.name)},
            {
                Header: 'Visibility', accessor: (mini: MiniType) => (
                    mini.visibility === PieceVisibilityEnum.FOGGED ? (mini.gmOnly ? 'Fog (hide)' : 'Fog (show)')
                        : getVisibilityString(mini.visibility)
                )
            }
        ];
        if (Object.keys(props.minis).find((miniId) => (props.minis[miniId].locked))) {
            columns.push(
                {Header: 'Locked', accessor: (mini: MiniType) => (mini.locked ? 'Y' : 'N')}
            )
        }
        return columns;
    }, [props.minis]);
    const data = useMemo(() => (
        // Sort by name, even though the table will too, so by name becomes the natural order
        Object.keys(props.minis)
            .sort((id1, id2) => {
                const name1 = props.minis[id1].name;
                const name2 = props.minis[id2].name;
                // TODO react-table sorts by something other than <, since this puts numbers before letters but theirs does the opposite.
                return name1 < name2 ? -1 : name1 === name2 ? 0 : 1
            })
            .map((miniId) => (props.minis[miniId]))
    ), [props.minis]);
    const {
        getTableProps,
        headerGroups,
        getTableBodyProps,
        rows,
        prepareRow
    } = useTable<MiniType>({columns, data, autoResetSortBy: false}, useSortBy);
    return (
        <div className='piecesTable'>
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

export default PiecesTable;