import '@testing-library/jest-dom/vitest';

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
}

if (typeof URL.createObjectURL !== 'function') {
  Object.defineProperty(URL, 'createObjectURL', {
    writable: true,
    value: () => 'blob:mock',
  });
}

if (typeof URL.revokeObjectURL !== 'function') {
  Object.defineProperty(URL, 'revokeObjectURL', {
    writable: true,
    value: () => {},
  });
}

Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  configurable: true,
  writable: true,
  value: () => Promise.resolve(),
});

Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  writable: true,
  value: () => {},
});

const canvasContextStub = {
  setTransform: () => {},
  scale: () => {},
  clearRect: () => {},
  fillRect: () => {},
  strokeRect: () => {},
  fillText: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  stroke: () => {},
  fillStyle: '',
  font: '',
  textAlign: 'left' as const,
  textBaseline: 'alphabetic' as const,
  globalAlpha: 1,
  lineWidth: 1,
  strokeStyle: '',
};

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  writable: true,
  value: () => canvasContextStub,
});

if (typeof Element.prototype.scrollIntoView !== 'function') {
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: () => {},
  });
}

const storage = new Map<string, string>();

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
    setItem: (key: string, value: string) => {
      storage.set(key, String(value));
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
  },
});
