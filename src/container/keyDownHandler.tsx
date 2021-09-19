import * as React from 'react';

export interface KeyHandler {
    callback: (evt: KeyboardEvent) => void;
    modifiers?: {
        ctrlKey?: boolean;
        metaKey?: boolean;
        shiftKey?: boolean;
        altKey?: boolean;
    }
}

interface KeyDownHandlerProps {
    keyMap: {[keyCode: string]: KeyHandler}
    disabled?: () => boolean;
}

export default class KeyDownHandler extends React.Component<KeyDownHandlerProps> {

    private readonly onMac: boolean;

    constructor(props: KeyDownHandlerProps) {
        super(props);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.onMac = !!window.navigator.platform.match(/^Mac/);
    }

    handleKeyDown(evt: KeyboardEvent) {
        const handler = this.props.keyMap[evt.key];
        if (handler && (!this.props.disabled || !this.props.disabled())){
            if (handler.modifiers) {
                if (
                    (handler.modifiers.altKey && !evt.altKey)
                    || (handler.modifiers.shiftKey && !evt.shiftKey)
                    || (handler.modifiers.ctrlKey && !evt.ctrlKey)
                    // treat metaKey is evt.metaKey on mac, and evt.ctrlKey on non-mac.
                    || (handler.modifiers.metaKey && !evt.metaKey && (this.onMac || !evt.ctrlKey))
                ) {
                    return;
                }
            }
            handler.callback(evt);
        }
    }

    componentDidMount() {
        document.addEventListener('keydown', this.handleKeyDown);
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    render() {
        return null;
    }
}