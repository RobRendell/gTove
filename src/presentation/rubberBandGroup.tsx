import * as React from 'react';
import * as PropTypes from 'prop-types';
import {findDOMNode} from 'react-dom';
import {throttle} from 'lodash';

import RubberBand, {RubberBandProps} from './rubberBand';

import './rubberBandGroup.scss';

interface SelectableGroupContext {
    selectableChildren: {[key: string]: Element | Text | null}
}

interface SelectableChildProps {
    childId: string;
}

export function makeSelectableChildHOC<P extends object>(Component: React.JSXElementConstructor<P>): React.JSXElementConstructor<P & SelectableChildProps> {
    return class SelectableChild extends React.Component<P & SelectableChildProps> {

        static contextTypes = {
            selectableChildren: PropTypes.object
        };

        context: SelectableGroupContext;

        componentWillUnmount(): void {
            delete(this.context.selectableChildren[this.props.childId]);
        }

        render() {
            const {childId, ...otherProps} = this.props;
            return (
                <Component ref={(ref: React.ReactInstance) => {
                    if (ref) {
                        if (!this.context.selectableChildren[childId]) {
                            this.context.selectableChildren[childId] = findDOMNode(ref);
                        }
                    } else {
                        delete(this.context.selectableChildren[childId]);
                    }
                }} {...otherProps as P}/>
            );
        }
    };
}

interface RubberBandGroupProps {
    setSelectedIds: (selectedIds: {[childId: string]: boolean}) => void;
    overlap?: number;
}

interface RubberBandGroupState {
    rubberBand?: RubberBandProps;
    showRubberBand?: boolean;
    startTimeout?: number;
    selectedIds: {[childId: string]: boolean};
}

export default class RubberBandGroup extends React.Component<RubberBandGroupProps, RubberBandGroupState> {

    private divRef: HTMLElement | null = null;

    static childContextTypes = {
        selectableChildren: PropTypes.object
    };

    private selectableChildren: {[key: string]: Element};

    getChildContext(): SelectableGroupContext {
        if (!this.selectableChildren) {
            this.selectableChildren = {};
        }
        return {
            selectableChildren: this.selectableChildren
        }
    }

    constructor(props: RubberBandGroupProps) {
        super(props);
        this.setRef = this.setRef.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onTouchStart = this.onTouchStart.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);
        this.setSelectedIds = throttle(this.setSelectedIds.bind(this), 100);
        this.state = {
            selectedIds: {}
        };
    }

    componentWillUnmount(): void {
        if (this.state.startTimeout) {
            window.clearTimeout(this.state.startTimeout);
        }
        if (this.divRef) {
            this.divRef.removeEventListener('touchmove', this.onTouchMove);
        }
    }

    setRef(ref: HTMLDivElement | null) {
        if (ref) {
            this.divRef = ref;
            // We have to manually add the event listener because react can't set passive: false.
            this.divRef.addEventListener('touchmove', this.onTouchMove, {passive: false});
        }
    }

    onMouseDown(evt: React.MouseEvent) {
        if (evt.currentTarget === this.divRef) {
            this.setState({
                rubberBand: {left: evt.clientX, top: evt.clientY, width: 0, height: 0},
                showRubberBand: true
            });
        }
    }

    onMouseMove(evt: React.MouseEvent) {
        if (this.state.rubberBand) {
            this.setState({
                rubberBand: {
                    ...this.state.rubberBand,
                    width: evt.clientX - this.state.rubberBand.left,
                    height: evt.clientY - this.state.rubberBand.top
                }
            });
            this.setSelectedIds();
        }
    }

    onMouseUp() {
        if (this.state.rubberBand) {
            this.setSelectedIds();
            this.setState({rubberBand: undefined, showRubberBand: false, startTimeout: undefined, selectedIds: {}});
        }
    }

    onTouchStart(evt: React.TouchEvent) {
        if (evt.currentTarget === this.divRef && evt.touches.length > 0) {
            const primaryTouch = evt.touches[0];
            this.setState({
                rubberBand: {left: primaryTouch.clientX, top: primaryTouch.clientY, width: 0, height: 0},
                showRubberBand: false,
                startTimeout: window.setTimeout(() => {
                    const rubberBand = this.state.rubberBand;
                    if (rubberBand && Math.abs(rubberBand.width) < 10 && Math.abs(+rubberBand.height) < 10) {
                        this.setState({showRubberBand: true});
                    }
                    this.setState({startTimeout: undefined});
                }, 500)
            });
        }
    }

    onTouchMove(evt: TouchEvent) {
        if (this.state.rubberBand && evt.touches.length > 0) {
            const primaryTouch = evt.touches[0];
            this.setState({
                rubberBand: {
                    ...this.state.rubberBand,
                    width: primaryTouch.clientX - this.state.rubberBand.left,
                    height: primaryTouch.clientY - this.state.rubberBand.top
                }
            });
            if (this.state.showRubberBand) {
                evt.preventDefault();
                this.setSelectedIds();
            }
        }
    }

    onTouchEnd(evt: React.TouchEvent) {
        if (evt.touches.length === 0) {
            if (this.state.startTimeout) {
                window.clearTimeout(this.state.startTimeout);
                this.setState({startTimeout: undefined});
            }
            if (this.state.rubberBand) {
                this.setSelectedIds();
                this.setState({rubberBand: undefined, showRubberBand: false, selectedIds: {}});
            }
        }
    }

    setSelectedIds() {
        // Find all selectable children overlapping the rubber band.
        const rect = this.state.rubberBand;
        const overlap = this.props.overlap || 10;
        if (rect && Math.abs(rect.width) > 2 * overlap && Math.abs(+rect.height) > 2 * overlap) {
            const minX = (rect.width < 0 ? rect.left + rect.width : rect.left) + overlap;
            const maxX = (rect.width > 0 ? rect.left + rect.width : rect.left) - overlap;
            const minY = (rect.height < 0 ? rect.top + rect.height : rect.top) + overlap;
            const maxY = (rect.height > 0 ? rect.top + rect.height : rect.top) - overlap;
            let selectedIds: {[childId: string]: boolean} = {};
            for (let childId of Object.keys(this.selectableChildren)) {
                const element = this.selectableChildren[childId];
                if (element) {
                    const bounds = element.getBoundingClientRect();
                    const x = bounds.left + window.scrollX;
                    const y = bounds.top + window.scrollY;
                    const selected = (x + bounds.width >= minX && x <= maxX
                        && y + bounds.height >= minY && y <= maxY);
                    if (selected || this.state.selectedIds[childId] !== undefined) {
                        selectedIds[childId] = selected;
                    }
                }
            }
            this.props.setSelectedIds(selectedIds);
            this.setState({selectedIds});
        }
    }

    render() {
        return (
            <div className='rubberBandGroup'
                 onMouseDown={this.onMouseDown} onMouseMove={this.onMouseMove} onMouseUp={this.onMouseUp}
                 onTouchStart={this.onTouchStart} onTouchEnd={this.onTouchEnd}
                 ref={this.setRef}
            >
                {this.props.children}
                {
                    !this.state.rubberBand || !this.state.showRubberBand ? null : (
                        <RubberBand {...this.state.rubberBand} />
                    )
                }
            </div>
        );
    }
}