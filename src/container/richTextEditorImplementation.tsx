import classNames from 'classnames';
import {forwardRef, useContext, useEffect, useImperativeHandle, useRef, useState} from 'react';
import RichTextEditor from 'react-rte';

import {DisableGlobalKeyboardHandlerContextObject} from '../context/disableGlobalKeyboardHandlerProvider';

export interface RichTextEditorImplementationHandle {
    finalise: () => string;
}

interface RichTextEditorImplementationProps {
    value: string;
    className?: string;
}

// This component is loaded on demand using React.lazy
const RichTextEditorImplementation = forwardRef<RichTextEditorImplementationHandle, RichTextEditorImplementationProps>(
    ({value, className}, ref) => {
        const [editorValue, setEditorValue] = useState(RichTextEditor.createValueFromString(value, 'markdown'));
        const editorValueRef = useRef(editorValue);
        editorValueRef.current = editorValue;

        useImperativeHandle(ref, () => ({
            finalise: () => (
                editorValueRef.current.toString('markdown')
            )
        }))

        const disableGlobalKeyboardHandler = useContext(DisableGlobalKeyboardHandlerContextObject);
        useEffect(() => {
            disableGlobalKeyboardHandler(true);
            return () => {
                disableGlobalKeyboardHandler(false);
            }
        }, [disableGlobalKeyboardHandler]);

        return (
            <div className={classNames('richTextEditorImplementation', className)}>
                <RichTextEditor value={editorValue} onChange={setEditorValue}/>
            </div>
        );
    }
);

export default RichTextEditorImplementation;