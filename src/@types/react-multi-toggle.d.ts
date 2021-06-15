declare module 'react-multi-toggle' {

    import {Component} from 'react';

    export interface ReactMultiToggleOption<T> {
        value: T;
        displayName?: string;
        optionClass?: string;
    }

    interface ReactMultiToggleProps<T> {
        options: ReactMultiToggleOption<T>[];
        selectedOption: T;
        onSelectOption: (value: T) => any;
        label?: any;
        className?: string;
    }

    export default class MultiToggle<T> extends Component<ReactMultiToggleProps<T>> {
    }
}