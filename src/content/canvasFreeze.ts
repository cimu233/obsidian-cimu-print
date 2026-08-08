export function freezeCanvasPixels(source: HTMLElement, clone: HTMLElement): void {
    const sourceCanvases = [
        ...(source.instanceOf(HTMLCanvasElement) ? [source] : []),
        ...Array.from(source.querySelectorAll<HTMLCanvasElement>('canvas'))
    ];
    const clonedCanvases = [
        ...(clone.instanceOf(HTMLCanvasElement) ? [clone] : []),
        ...Array.from(clone.querySelectorAll<HTMLCanvasElement>('canvas'))
    ];

    sourceCanvases.forEach((canvas, index) => {
        const clonedCanvas = clonedCanvases[index];
        if (!clonedCanvas) {
            return;
        }
        replaceWithSnapshot(canvas, clonedCanvas);
    });
}

function replaceWithSnapshot(source: HTMLCanvasElement, target: HTMLCanvasElement): void {
    const parent = target.parentNode;
    const dataUrl = canvasSnapshot(source);
    if (!parent || !dataUrl) {
        return;
    }

    const image = target.ownerDocument.createElement('img');
    for (const attribute of Array.from(source.attributes)) {
        image.setAttribute(attribute.name, attribute.value);
    }
    image.src = dataUrl;
    image.alt = image.alt || '';
    if (source.width > 0) {
        image.width = source.width;
    }
    if (source.height > 0) {
        image.height = source.height;
    }
    parent.replaceChild(image, target);
}

function canvasSnapshot(canvas: HTMLCanvasElement): string | null {
    try {
        return typeof canvas.toDataURL === 'function' ? canvas.toDataURL('image/png') : null;
    } catch {
        return null;
    }
}
