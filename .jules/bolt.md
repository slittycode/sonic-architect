## 2024-05-23 - React D3 Re-rendering & DOM Thrashing
**Learning:** Initializing D3 visualizations inside a React effect that depends on frequently changing state (like `isPlaying`) causes the entire DOM structure to be destroyed and recreated on every state change. This is a major performance anti-pattern and causes visual glitches (resetting random data).
**Action:** Always separate D3 static initialization (DOM creation) from dynamic updates (animation/transitions) into separate `useEffect` hooks. Store D3 selections or data in `useRef` or `useMemo` to persist them across re-renders.
