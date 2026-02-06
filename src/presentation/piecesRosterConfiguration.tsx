import {FunctionComponent, useMemo} from 'react';
import {SortableContainer, SortableElement, SortableHandle} from 'react-sortable-hoc';
import arrayMove from 'array-move';
import ReactDropdown from 'react-dropdown-now';
import {v4} from 'uuid';

import {intrinsicFieldValueMap, isNameColumn, PiecesRosterColumn, PiecesRosterColumnType} from '../util/scenarioUtils';
import InputButton from './inputButton';
import InputField from './inputField';
import MovableWindowRemountChild from '../container/movableWindowRemountChild';
import Tooltip from './tooltip';

import './piecesRosterConfiguration.scss';

const ColumnConfigDragHandle = SortableHandle(() => (
    <div className='dragHandle material-icons'>drag_indicator</div>
));

const columnTypeLabels = {
    [PiecesRosterColumnType.INTRINSIC]: 'Built-in',
    [PiecesRosterColumnType.STRING]: 'String',
    [PiecesRosterColumnType.NUMBER]: 'Number',
    [PiecesRosterColumnType.BONUS]: 'Bonus (always signed)',
    [PiecesRosterColumnType.FRACTION]: 'Fraction (e.g. hit points)'
    // [PiecesRosterColumnType.STATUS]: 'Status icon(s)'
};

interface ColumnConfigProps {
    column: PiecesRosterColumn;
    columns: PiecesRosterColumn[];
    updateColumn(update: Partial<PiecesRosterColumn>): void;
    deleteColumn(): void;
}

const ColumnConfig = SortableElement(({column, columns, updateColumn, deleteColumn}: ColumnConfigProps) => {
    const intrinsicFields = useMemo(() => {
        const usedFields = columns.reduce((used: {[name: string]: boolean}, otherColumn) => {
            if (otherColumn.id !== column.id && otherColumn.type === PiecesRosterColumnType.INTRINSIC) {
                used[otherColumn.name] = true;
            }
            return used;
        }, {});
        return Object.keys(intrinsicFieldValueMap).filter((field) => (!usedFields[field])).sort()
    }, [column, columns]);
    const intrinsicFieldValue = useMemo(() => (
        intrinsicFieldValueMap[column.name] ? column.name : intrinsicFields.length > 0 ? intrinsicFields[0] : ''
    ), [column, intrinsicFields]);
    const columnTypeOptions = useMemo(() => (
        Object.keys(PiecesRosterColumnType)
            .filter((key) => (intrinsicFieldValue 
                || PiecesRosterColumnType[key as keyof typeof PiecesRosterColumnType] !== PiecesRosterColumnType.INTRINSIC))
            .map((value) => ({
                value, label: columnTypeLabels[PiecesRosterColumnType[value as keyof typeof PiecesRosterColumnType]]
            }))
    ), [intrinsicFieldValue]);
    return (
        <div className='columnConfig'>
            <div className='labelled'>
                <label>Column type: </label>
                <ReactDropdown options={columnTypeOptions}
                               value={columnTypeOptions.find((option) => option.value === column.type)}
                               onChange={(value) => {
                                   const type = value.value;
                                   updateColumn({type, name: type === PiecesRosterColumnType.INTRINSIC ? intrinsicFieldValue : column.name});
                               }}
                />
            </div>
            <div className='labelled'>
                {
                    column.type === PiecesRosterColumnType.INTRINSIC ? (
                        <>
                            <label>Built-in type: </label>
                            <ReactDropdown options={intrinsicFields} value={intrinsicFieldValue}
                                           onChange={(value) => {
                                               updateColumn({name: value.value});
                                           }}/>
                        </>
                    ) : (
                        <>
                            <label>Column name: </label>
                            <InputField type='text' placeholder='Name' initialValue={column.name} onChange={(value) => {
                                updateColumn({name: value});
                            }}/>
                        </>
                    )
                }
            </div>
            <InputButton type='checkbox' selected={!column.gmOnly} onChange={() => {
                updateColumn({gmOnly: !column.gmOnly});
            }}>Visible to all</InputButton>
            {
                column.type === PiecesRosterColumnType.INTRINSIC && !isNameColumn(column) ? null : (
                    <InputButton type='checkbox' selected={!!column.showNear} onChange={() => {
                        updateColumn({showNear: !column.showNear});
                    }}>Show value near mini</InputButton>
                )
            }
            <Tooltip className='delete' tooltip='Remove this column from the roster.'>
                <span className='material-icons' onClick={deleteColumn}>delete</span>
            </Tooltip>
            <ColumnConfigDragHandle/>
        </div>
    )
});

interface ColumnListProps {
    columns: PiecesRosterColumn[];
    setColumns(columns: PiecesRosterColumn[]): void;
}

const ColumnList = SortableContainer(({columns, setColumns}: ColumnListProps) => (
    <div>
        {
            columns.map((column, index) => (
                <ColumnConfig key={column.id} column={column} columns={columns} index={index}
                              updateColumn={(update: Partial<PiecesRosterColumn>) => {
                                  const newState = [...columns];
                                  newState[index] = {...columns[index], ...update} as PiecesRosterColumn;
                                  setColumns(newState);
                              }}
                              deleteColumn={() => {
                                  setColumns([...columns.slice(0, index), ...columns.slice(index + 1)]);
                              }}
                />
            ))
        }
    </div>
));

interface PiecesRosterConfigurationProps {
    columns: PiecesRosterColumn[];
    setColumns(columns: PiecesRosterColumn[]): void;
}

const PiecesRosterConfiguration: FunctionComponent<PiecesRosterConfigurationProps> = ({columns, setColumns}) => {
    return (
        <MovableWindowRemountChild>
            <div className='piecesRosterConfig'>
                <div className='columnList'>
                    <p>Add, remove, reorder and reconfigure the columns of the Pieces Roster below.</p>
                    <ColumnList columns={columns} setColumns={setColumns} onSortEnd={({oldIndex, newIndex}) => {
                        setColumns(arrayMove(columns, oldIndex, newIndex));
                    }} lockAxis='y' useDragHandle={true}/>
                </div>
                <InputButton className='addButton' type='button' onChange={() => {
                    setColumns([...columns, {
                        name: 'New column', id: v4(), type: PiecesRosterColumnType.STRING, gmOnly: true, showNear: false
                    }])
                }}>Add new column</InputButton>
            </div>
        </MovableWindowRemountChild>
    );
};

export default PiecesRosterConfiguration;