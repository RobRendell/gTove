import {FunctionComponent, PropsWithChildren} from 'react';

import {useOnClickOutside} from '../hooks/useOnClickOutside';

interface OnClickOutsideWrapperProps extends PropsWithChildren {
    onClickOutside: () => void;
}

const OnClickOutsideWrapper: FunctionComponent<OnClickOutsideWrapperProps> = ({onClickOutside, children}) => {
    const itemRef = useOnClickOutside<HTMLDivElement>(onClickOutside, [onClickOutside])

    return (
        <div ref={itemRef}>
            {children}
        </div>
    )
}
export default OnClickOutsideWrapper;