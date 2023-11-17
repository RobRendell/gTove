import {FunctionComponent, useCallback} from 'react';
import {arrayMove, SortableContainer, SortableElement, SortableHandle} from 'react-sortable-hoc';
import {useDispatch, useSelector} from 'react-redux';

import './diceBagEditor.scss';

import {getDiceBagFromStore} from '../../redux/mainReducer';
import InputButton from '../inputButton';
import {setDieTypeNamesAction} from '../../redux/diceBagReducer';

interface DiceBagEditorProps {
    onClose: () => void;
}

const DieDefinitionDragHandle = SortableHandle(() => (
    <div className='dragHandle material-icons'>drag_indicator</div>
));

interface DieDefinitionProps {
    dieType: string;
}

const DieDefinition = SortableElement(({dieType}: DieDefinitionProps) => {
    return (
        <div className='dieDefinition'>
            <DieDefinitionDragHandle />
            {dieType}
        </div>
    )
});

interface DieDefinitionContainerProps {
    dieTypeNames: string[];
}

const DieDefinitionContainer = SortableContainer(({dieTypeNames}: DieDefinitionContainerProps) => {
    return (
        <div>
            {
                dieTypeNames.map((dieType, index) => (
                    <DieDefinition key={dieType} dieType={dieType} index={index} />
                ))
            }
        </div>
    )
});

const DiceBagEditor: FunctionComponent<DiceBagEditorProps> = ({onClose}) => {
    const dispatch = useDispatch();
    const {dieTypeNames} = useSelector(getDiceBagFromStore);
    const onSortEnd = useCallback(({oldIndex, newIndex}) => {
        dispatch(setDieTypeNamesAction(arrayMove(dieTypeNames, oldIndex, newIndex)));
    }, [dieTypeNames, dispatch]);
    return (
        <>
            <DieDefinitionContainer lockAxis='y' useDragHandle={true} onSortEnd={onSortEnd}
                                    dieTypeNames={dieTypeNames}
            />
            <InputButton type='button' onChange={onClose}>Finish</InputButton>
        </>
    );
};

export default DiceBagEditor;