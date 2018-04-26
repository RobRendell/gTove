import {Uniform} from 'three';
import {EventDispatcher, PixelFormat, TextureFilter} from 'three/three-core';

declare module 'three' {

    export interface Uniform {
        type: string;
        value: any;
        dynamic?: boolean;
        onUpdateCallback?: () => void;
    }

    export class Texture extends EventDispatcher {

        public minFilter: TextureFilter;
        public image: HTMLImageElement;
        public needsUpdate: boolean;
        public format?: PixelFormat;

        constructor(image?: ImageData | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement);
    }

}