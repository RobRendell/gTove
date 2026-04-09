import {FunctionComponent, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Camera, Object3D, Vector3} from 'three';

import InputButton from '../presentation/inputButton';
import {TabletopViewComponentEditSelected} from '../presentation/tabletopViewComponent';
import InputField from './inputField';

interface TabletopEditSelectedProps {
    editSelected?: TabletopViewComponentEditSelected
    clearEditSelected: () => void;
    camera: Camera;
    width: number;
    height: number;
}

const TabletopEditSelected: FunctionComponent<TabletopEditSelectedProps> = ({editSelected, clearEditSelected, camera, width, height}) => {
    // This component can't call useThree to get the camera and dimensions, as it's not rendered inside the R3F Canvas.
    const offsetRef = useRef(new Vector3());
    const [value, setValue] = useState(editSelected?.value);
    const editSelectedValue = editSelected?.value;
    useEffect(() => {
        if (editSelectedValue !== undefined) {
            setValue(editSelectedValue)
        }
    }, [editSelectedValue]);

    const object3DToScreenCoords = useCallback((object: Object3D) => {
        object.getWorldPosition(offsetRef.current);
        const projected = offsetRef.current.project(camera!);
        return {x: (1 + projected.x) * width / 2, y: (1 - projected.y) * height / 2};
    }, [camera, height, width]);

    const position = useMemo(() => (
        !editSelected ? {x: 0, y: 0}
            : editSelected.selected.object ? object3DToScreenCoords(editSelected.selected.object)
                : {x: editSelected.selected.position!.x + 10, y: editSelected.selected.position!.y + 10}
    ), [editSelected, object3DToScreenCoords]);

    const okAction = useCallback(() => {
        if (editSelected && value !== undefined) {
            editSelected.finish(value);
            clearEditSelected();
        }
    }, [clearEditSelected, editSelected, value]);

    const specialKeys = useMemo(() => ({
        Escape: clearEditSelected,
        Esc: clearEditSelected,
        Return: okAction,
        Enter: okAction
    }), [clearEditSelected, okAction]);

    return !editSelected ? null : (
        <div className='menuEditSelected' style={{top: position.y, left: position.x}}>
            <InputField type='text' initialValue={editSelected.value} focus={true} onChange={setValue}
                        specialKeys={specialKeys}/>
            <InputButton type='button' onChange={okAction}>OK</InputButton>
            <InputButton type='button' onChange={clearEditSelected}>Cancel</InputButton>
        </div>
    );
}

export default TabletopEditSelected;