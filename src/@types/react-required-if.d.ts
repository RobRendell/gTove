declare module 'react-required-if' {

    import {Requireable} from 'prop-types';

    type RequiredIf = <T>(type: Requireable<any>, required: (props: T) => boolean) => Requireable<any>;

    const requiredIf: RequiredIf;

    export default requiredIf;
}