
import {Uniform} from 'three';

declare module 'three' {

    export interface Uniform {
        type: string;
        value: any;
        dynamic?: boolean;
        onUpdateCallback?: () => void;
    }

}