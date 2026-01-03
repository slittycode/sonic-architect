# Palette's Journal - Critical UX/A11y Learnings

## 2024-05-23 - Focus Management in React
**Learning:** React's virtual DOM updates can cause focus to be lost if the focused element is re-rendered or removed.
**Action:** Use `useEffect` with refs to manually restore focus after specific state changes, especially for modals or dynamic lists.
