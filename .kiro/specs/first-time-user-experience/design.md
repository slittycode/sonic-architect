# Design Document: First-Time User Experience

## Overview

This design addresses the first-time user experience improvements for Sonic Architect, a browser-based audio analysis tool that generates Ableton Live 12 reconstruction blueprints. The current application lacks onboarding, has unclear value proposition presentation, and missing responsive design that prevents new users from understanding and effectively using the tool.

### Goals

- Provide immediate clarity on what Sonic Architect does and its value proposition
- Guide users through their first analysis with clear visual feedback
- Ensure the application works seamlessly across desktop, tablet, and mobile devices
- Maintain the existing dark theme aesthetic and professional feel
- Preserve all existing functionality while adding purely additive UI improvements

### Non-Goals

- Changing the core analysis engine or provider system
- Modifying the blueprint generation logic
- Adding new dependencies beyond what's strictly necessary
- Redesigning the existing component architecture
- Changing the color scheme or fundamental visual identity

### Key Design Decisions

1. **State-based UI**: Use React 19's built-in state management (useState, useEffect) rather than introducing external state libraries
2. **CSS-only animations**: Leverage Tailwind's animation utilities and CSS transitions for smooth state changes
3. **Progressive enhancement**: Start with mobile-first responsive design, enhance for larger screens
4. **Local storage for preferences**: Track first-time user status using localStorage to persist hero state
5. **Component composition**: Create small, focused components that can be easily tested and maintained

## Architecture

### Component Hierarchy

```
App.tsx (root)
├── Header (existing, no changes)
├── LandingHero (new)
│   ├── HeroExpanded (first-time users)
│   └── HeroMinimized (returning users)
├── UploadSection (enhanced)
│   ├── UploadZone (enhanced with drag-drop feedback)
│   ├── ProviderSelector (enhanced with clarity improvements)
│   └── FileFormatBadges (new)
├── AnalysisStateDisplay (enhanced)
│   ├── LoadingState (enhanced)
│   ├── ProgressIndicator (new)
│   └── ErrorState (existing, enhanced)
├── BlueprintDisplay (existing, enhanced with navigation)
│   └── BlueprintNavigation (new)
├── SessionMusician (existing, enhanced with empty state)
└── Footer (existing, no changes)
```

### State Management Strategy

The application will use React 19's built-in hooks for state management:

**App-level state** (in App.tsx):
- `isFirstTimeUser: boolean` - Tracks if user has completed first analysis
- `uploadState: 'idle' | 'dragover' | 'uploading' | 'analyzing' | 'complete' | 'error'`
- `showHero: boolean` - Controls hero visibility (derived from isFirstTimeUser)
- All existing state remains unchanged

**Component-level state**:
- LandingHero: `isMinimized: boolean`
- UploadZone: `isDragOver: boolean`, `dragError: string | null`
- BlueprintNavigation: `activeSection: string`

**Persistence**:
- Use localStorage key `sonic-architect-first-time` to track completion of first analysis
- Check on mount, update after first successful analysis

### Responsive Breakpoints

Following Tailwind's default breakpoints:
- Mobile: < 768px (sm)
- Tablet: 768px - 1024px (md to lg)
- Desktop: > 1024px (lg+)

Layout adaptations:
- Mobile: Single column, stacked components, touch-friendly 44px minimum tap targets
- Tablet: Two-column where appropriate, slightly larger text
- Desktop: Three-column blueprint display (existing), full feature set

## Components and Interfaces

### 1. LandingHero Component

**Purpose**: Introduce first-time users to Sonic Architect's capabilities

**Props**:
```typescript
interface LandingHeroProps {
  isMinimized: boolean;
  onDismiss: () => void;
}
```

**State**:
```typescript
const [isExpanded, setIsExpanded] = useState(!isMinimized);
```

**Behavior**:
- Renders expanded on first visit
- Animates to minimized state after first successful analysis
- Can be manually toggled by returning users
- Smooth height transition (300ms ease-in-out)

**Content**:
- Headline: "Deconstruct Any Track into an Ableton Live Blueprint"
- Feature highlights:
  - "🎯 Local Analysis - No API keys, works offline"
  - "🎹 MIDI Transcription - Audio to MIDI conversion"
  - "📋 Ableton Blueprint - Complete device chain reconstruction"
- CTA button: "Get Started" (scrolls to upload zone)

### 2. Enhanced UploadZone Component

**Purpose**: Provide clear drag-and-drop interface with visual feedback

**Props**:
```typescript
interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  disabled: boolean;
  status: AnalysisStatus;
}
```

**State**:
```typescript
const [isDragOver, setIsDragOver] = useState(false);
const [dragError, setDragError] = useState<string | null>(null);
```

**Behavior**:
- Highlight border and background on dragover
- Show error message for invalid file types
- Display supported formats as badges
- Show file size guidance (max 100MB)
- Validate file type and size before accepting

**Visual States**:
- Idle: Dashed border, zinc-800
- Drag over (valid): Solid border, blue-500, blue glow
- Drag over (invalid): Solid border, red-500, red glow
- Disabled: Opacity 50%, cursor not-allowed

### 3. ProviderSelector Enhancement

**Purpose**: Make provider selection clearer, especially for first-time users

**Changes to existing component**:
- Add "Free" badge to Local DSP option (green, small)
- Add "Enhanced" badge to Gemini and Ollama (blue, small)
- Emphasize "No API key needed" for Local DSP
- Add setup links for Gemini and Ollama when selected
- Improve visual hierarchy with icons and better spacing

**No new props needed** - enhancement to existing component

### 4. AnalysisStateDisplay Component

**Purpose**: Provide smooth transitions and clear feedback during analysis

**Props**:
```typescript
interface AnalysisStateDisplayProps {
  status: AnalysisStatus;
  provider: ProviderType;
  progress?: number; // 0-100, optional
}
```

**Behavior**:
- Fade in loading state (200ms)
- Show animated spinner
- Display provider-specific messages
- Smooth transition to results (400ms)
- Error state with retry option

**Animation timing**:
- State change detection: < 50ms
- Fade in: 200ms
- Fade out: 100ms
- Slide transitions: 300ms

### 5. BlueprintNavigation Component

**Purpose**: Enable quick navigation to blueprint sections

**Props**:
```typescript
interface BlueprintNavigationProps {
  sections: Array<{ id: string; label: string; icon: LucideIcon }>;
  onNavigate: (sectionId: string) => void;
}
```

**State**:
```typescript
const [activeSection, setActiveSection] = useState<string>('telemetry');
```

**Behavior**:
- Sticky navigation bar below blueprint header
- Smooth scroll to section (300ms)
- Highlight active section
- Responsive: Horizontal scroll on mobile, full width on desktop

**Sections**:
- Telemetry (Activity icon)
- Arrangement (Clock icon)
- Instruments (Layers icon)
- FX (Settings2 icon)
- Secret Sauce (Sparkles icon)

### 6. FileFormatBadges Component

**Purpose**: Display supported file formats clearly

**Props**:
```typescript
interface FileFormatBadgesProps {
  formats: string[]; // ['WAV', 'MP3', 'FLAC', 'OGG', 'AAC', 'M4A']
}
```

**Rendering**:
- Small pill-shaped badges
- Zinc-800 background, zinc-400 text
- Displayed in upload zone
- Responsive: Wrap on mobile, inline on desktop

## Data Models

### FirstTimeUserState

```typescript
interface FirstTimeUserState {
  hasCompletedAnalysis: boolean;
  firstAnalysisDate: string | null; // ISO date string
  analysisCount: number;
}
```

Stored in localStorage as `sonic-architect-first-time`:
```json
{
  "hasCompletedAnalysis": true,
  "firstAnalysisDate": "2025-01-15T10:30:00.000Z",
  "analysisCount": 1
}
```

### UploadState

```typescript
type UploadState = 
  | { status: 'idle' }
  | { status: 'dragover'; isValid: boolean }
  | { status: 'uploading'; progress: number }
  | { status: 'analyzing' }
  | { status: 'complete' }
  | { status: 'error'; message: string };
```

### NavigationSection

```typescript
interface NavigationSection {
  id: string; // 'telemetry' | 'arrangement' | 'instruments' | 'fx' | 'secret-sauce'
  label: string;
  icon: LucideIcon;
  ref: React.RefObject<HTMLDivElement>;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

After analyzing all acceptance criteria, I've identified the following consolidations to eliminate redundancy:

**Consolidations:**
1. Properties 5.2-5.6 (individual navigation sections) can be combined into one property that checks all required sections exist
2. Properties 6.1, 6.3, 6.4 (responsive layouts at different breakpoints) can be combined into one property about responsive behavior
3. Properties 7.1, 7.2, 7.3, 7.4 (visual consistency checks) can be combined into one comprehensive styling consistency property
4. Properties 2.5 and 2.6 (file validation errors) can be combined into one property about invalid file handling
5. Properties 3.5 and 3.6 (provider setup links) can be combined into one property about conditional setup link display
6. Properties 4.2, 4.5, 8.3 (loading state display) are redundant - can be combined into one property
7. Properties 8.1 and 8.2 (empty states) can be combined into one property about empty state display

**Unique properties retained:**
- First-time user hero display behavior (1.1, 1.4, 1.5)
- Drag-and-drop visual feedback (2.2)
- State transitions (4.1, 4.3, 4.6)
- Blueprint navigation rendering (5.1)
- Touch-friendly controls on mobile (6.2)
- Hero responsive text (6.6)

This reduces approximately 50 testable criteria to about 20 unique, non-redundant properties.

### Property 1: First-time user hero display

*For any* user session where the localStorage flag indicates first-time status (no completed analysis), the Landing Hero component should render in expanded state above the upload zone.

**Validates: Requirements 1.1**

### Property 2: Hero state transition on analysis completion

*For any* successful analysis completion, if the user was previously a first-time user, the Landing Hero should transition to minimized state and the localStorage flag should be updated to indicate returning user status.

**Validates: Requirements 1.4**

### Property 3: Returning user hero state

*For any* user session where the localStorage flag indicates returning user status (has completed analysis), the Landing Hero component should render in minimized state.

**Validates: Requirements 1.5**

### Property 4: Dark theme color consistency

*For all* new UI components (LandingHero, FileFormatBadges, BlueprintNavigation, enhanced UploadZone), only colors from the existing dark theme palette (zinc-*, blue-*, purple-*, emerald-*, orange-*, indigo-*, red-*) should be used in Tailwind classes.

**Validates: Requirements 1.6, 7.1**

### Property 5: Drag-over visual feedback

*For any* drag event over the UploadZone with a valid audio file, the component should update its visual state to indicate a valid drop target (border color change, background highlight).

**Validates: Requirements 2.2**

### Property 6: Invalid file error handling

*For any* file dropped on the UploadZone that fails validation (unsupported type or exceeds size limit), an error message should be displayed specifying the validation failure reason.

**Validates: Requirements 2.5, 2.6**

### Property 7: Provider setup link display

*For any* provider selection change to Gemini or Ollama, if that provider is not available (no API key or server not running), a setup link should be displayed with configuration instructions.

**Validates: Requirements 3.5, 3.6**

### Property 8: Upload to analyzing state transition

*For any* valid file upload, the application state should transition from upload/idle state to analyzing state.

**Validates: Requirements 4.1**

### Property 9: Loading state display during analysis

*For any* time period when the analysis status is 'ANALYZING', a loading indicator with visual feedback should be rendered.

**Validates: Requirements 4.2, 4.5, 8.3**

### Property 10: Analysis completion state transition

*For any* successful analysis completion, the application state should transition from analyzing state to completed state with results displayed.

**Validates: Requirements 4.3**

### Property 11: Analysis error handling

*For any* analysis failure, the application should display an error message and return to the upload-ready state, allowing retry.

**Validates: Requirements 4.6**

### Property 12: Blueprint navigation rendering

*For any* rendered blueprint, navigation controls should be displayed containing links to all major sections (Telemetry, Arrangement, Instruments, FX, Secret Sauce).

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**

### Property 13: Responsive layout adaptation

*For any* viewport width, the application should apply appropriate layout classes: single-column for < 768px, two-column for 768-1024px, and multi-column desktop layout for > 1024px.

**Validates: Requirements 6.1, 6.3, 6.4**

### Property 14: Touch-friendly mobile controls

*For any* interactive element rendered at viewport width < 768px, the minimum tap target size should be 44px × 44px.

**Validates: Requirements 6.2**

### Property 15: Hero responsive typography

*For any* viewport width < 768px, the Landing Hero should apply mobile-specific text size classes (smaller headings, adjusted spacing).

**Validates: Requirements 6.6**

### Property 16: Tailwind-only styling

*For all* new and enhanced components, styling should be implemented exclusively through Tailwind CSS classes without inline styles or custom CSS classes.

**Validates: Requirements 7.2, 7.3, 7.4**

### Property 17: Empty state display

*For any* component (UploadZone, SessionMusician) in an empty/idle state with no data, an appropriate empty state message with instructions should be displayed.

**Validates: Requirements 8.1, 8.2**

## Error Handling

### File Upload Errors

**Invalid file type**:
- Detection: Check file.type and file extension against allowed list
- User feedback: Red border on upload zone, error message: "Unsupported file type. Please upload WAV, MP3, FLAC, OGG, AAC, or M4A files."
- Recovery: Clear error on next valid drag or file selection

**File size exceeded**:
- Detection: Check file.size > MAX_FILE_SIZE (100MB)
- User feedback: Red border, error message: "File size exceeds 100MB limit. Please upload a smaller file."
- Recovery: Clear error on next valid file selection

**Drag-and-drop not supported**:
- Detection: Browser doesn't support drag events
- Fallback: Show only file input button, hide drag instructions
- User feedback: None needed, graceful degradation

### State Transition Errors

**Analysis fails after upload**:
- Detection: Catch errors from analysis provider
- User feedback: Error banner with specific error message and "Retry" button
- Recovery: Return to upload-ready state, preserve last file for retry
- Logging: Console.error with full error details

**Provider unavailable**:
- Detection: Provider.isAvailable() returns false
- User feedback: Warning banner: "Provider unavailable, falling back to Local DSP"
- Recovery: Automatic fallback to local provider
- Persistence: Don't change user's provider preference

### Responsive Design Errors

**Viewport too small for feature**:
- Detection: Check window.innerWidth for critical features
- User feedback: Adapt UI, don't show error
- Recovery: N/A - responsive design handles this

**Touch events not supported**:
- Detection: Check for touch event support
- Fallback: Mouse events work as alternative
- User feedback: None needed

### LocalStorage Errors

**localStorage not available**:
- Detection: Try-catch around localStorage access
- Fallback: Use in-memory state, hero shows expanded every session
- User feedback: None - graceful degradation
- Impact: First-time user tracking won't persist across sessions

**localStorage quota exceeded**:
- Detection: Catch QuotaExceededError
- Fallback: Continue without persistence
- User feedback: None - non-critical feature
- Logging: Console.warn

## Testing Strategy

### Dual Testing Approach

This feature will use both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests** will focus on:
- Specific examples of component rendering (hero expanded/minimized states)
- Edge cases (empty states, error states, boundary viewport sizes)
- Integration points (localStorage interaction, state updates)
- User interactions (button clicks, drag events, navigation)

**Property-Based Tests** will focus on:
- Universal properties across all inputs (responsive behavior at any viewport size)
- State transitions (any valid file upload triggers analyzing state)
- Validation rules (any invalid file shows error)
- Visual consistency (all components use theme colors)

Together, these approaches provide comprehensive coverage: unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across the input space.

### Property-Based Testing Configuration

**Library**: We'll use `@fast-check/vitest` for property-based testing in the React/TypeScript environment.

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with comment referencing design property
- Tag format: `// Feature: first-time-user-experience, Property {number}: {property_text}`

**Example property test structure**:
```typescript
// Feature: first-time-user-experience, Property 13: Responsive layout adaptation
test.prop([fc.integer({ min: 320, max: 2560 })])('responsive layout adapts to viewport width', (viewportWidth) => {
  // Test that appropriate layout classes are applied based on viewport width
  const expectedLayout = viewportWidth < 768 ? 'single-column' 
    : viewportWidth < 1024 ? 'two-column' 
    : 'multi-column';
  
  // Render component at viewport width and verify layout
  // ...
});
```

### Unit Testing Strategy

**Component Tests**:
- LandingHero: Expanded/minimized rendering, dismiss action, responsive text
- UploadZone: Drag events, file validation, error display, format badges
- ProviderSelector: Badge display, setup links, selection changes
- BlueprintNavigation: Section rendering, scroll behavior, active state
- FileFormatBadges: Badge rendering, responsive wrapping

**Integration Tests**:
- First-time user flow: Load app → see hero → upload file → hero minimizes → localStorage updated
- Error recovery: Invalid file → error shown → valid file → error cleared → analysis proceeds
- Provider fallback: Select unavailable provider → warning shown → fallback to local → analysis works
- Responsive behavior: Resize viewport → layout adapts → all features remain functional

**State Management Tests**:
- localStorage persistence: Set first-time flag → reload → flag persists
- State transitions: Idle → analyzing → complete → idle (reset)
- Error states: Analyzing → error → idle (with retry option)

### Test Coverage Goals

- Component rendering: 100% of new components
- State transitions: 100% of defined transitions
- Error handling: 100% of error paths
- Responsive breakpoints: All three breakpoints (mobile, tablet, desktop)
- User interactions: All interactive elements (buttons, drag-drop, navigation)

### Testing Tools

- **Vitest**: Test runner (already in project)
- **@testing-library/react**: Component testing (already in project)
- **@fast-check/vitest**: Property-based testing (new dependency - required for property tests)
- **jsdom**: DOM environment for tests (already in project)

### Test Organization

```
__tests__/
├── components/
│   ├── LandingHero.test.tsx
│   ├── LandingHero.properties.test.tsx
│   ├── UploadZone.test.tsx
│   ├── UploadZone.properties.test.tsx
│   ├── BlueprintNavigation.test.tsx
│   └── FileFormatBadges.test.tsx
├── integration/
│   ├── first-time-user-flow.test.tsx
│   ├── responsive-behavior.test.tsx
│   └── error-recovery.test.tsx
└── properties/
    ├── responsive-layout.properties.test.tsx
    ├── theme-consistency.properties.test.tsx
    └── state-transitions.properties.test.tsx
```

### Property Test Examples

Each correctness property will be implemented as a property-based test:

**Property 4: Dark theme color consistency**
```typescript
// Feature: first-time-user-experience, Property 4: Dark theme color consistency
test.prop([fc.constantFrom('LandingHero', 'FileFormatBadges', 'BlueprintNavigation')])
  ('all new components use only dark theme colors', (componentName) => {
    // Render component, extract all Tailwind classes
    // Verify all color classes are from allowed palette
    // Assert no custom colors or inline styles
  });
```

**Property 13: Responsive layout adaptation**
```typescript
// Feature: first-time-user-experience, Property 13: Responsive layout adaptation
test.prop([fc.integer({ min: 320, max: 2560 })])
  ('layout adapts correctly to any viewport width', (width) => {
    // Set viewport width
    // Render app
    // Verify correct layout classes applied
    // Verify all content remains accessible
  });
```

**Property 6: Invalid file error handling**
```typescript
// Feature: first-time-user-experience, Property 6: Invalid file error handling
test.prop([
  fc.record({
    name: fc.string(),
    size: fc.integer({ min: 0, max: 200_000_000 }),
    type: fc.constantFrom('text/plain', 'image/png', 'video/mp4')
  })
])('invalid files show appropriate error messages', (invalidFile) => {
  // Create mock file with invalid properties
  // Trigger drop event
  // Verify error message displayed
  // Verify error message content is appropriate
});
```

### Manual Testing Checklist

Some aspects require manual verification:

- [ ] Animation smoothness (200-400ms transitions feel natural)
- [ ] Touch interactions on actual mobile devices
- [ ] Visual hierarchy and prominence of Local DSP option
- [ ] Hero collapse animation feels smooth
- [ ] Scroll behavior to blueprint sections is smooth (300ms)
- [ ] Loading states appear quickly (< 50ms perceived)
- [ ] Overall aesthetic matches existing dark theme
- [ ] Accessibility: Keyboard navigation works for all interactive elements
- [ ] Accessibility: Screen reader announces state changes appropriately

## Implementation Plan

### Phase 1: Core Components (Days 1-2)

1. Create LandingHero component
   - Expanded and minimized states
   - Responsive typography
   - Smooth transitions
   - localStorage integration

2. Enhance UploadZone component
   - Drag-and-drop visual feedback
   - File validation with error messages
   - FileFormatBadges sub-component
   - Touch-friendly sizing

3. Update App.tsx state management
   - Add first-time user tracking
   - Add upload state management
   - Integrate hero display logic

### Phase 2: Enhanced Feedback (Days 3-4)

4. Enhance ProviderSelector
   - Add badges (Free, Enhanced)
   - Add setup links
   - Improve visual hierarchy

5. Create AnalysisStateDisplay enhancements
   - Smooth loading transitions
   - Progress feedback
   - Error state improvements

6. Add empty states
   - UploadZone empty state
   - SessionMusician empty state

### Phase 3: Navigation & Responsive (Days 5-6)

7. Create BlueprintNavigation component
   - Section links with icons
   - Smooth scroll behavior
   - Active section highlighting
   - Responsive horizontal scroll

8. Implement responsive design
   - Mobile-first CSS
   - Breakpoint-specific layouts
   - Touch-friendly controls
   - Test across viewport sizes

### Phase 4: Testing & Polish (Days 7-8)

9. Write unit tests
   - Component rendering tests
   - Interaction tests
   - State management tests

10. Write property-based tests
    - Install @fast-check/vitest
    - Implement all 17 properties
    - Run with 100+ iterations

11. Manual testing & polish
    - Test on real devices
    - Verify animations
    - Check accessibility
    - Fix any issues

### Phase 5: Documentation & Deployment (Day 9)

12. Update documentation
    - Component usage examples
    - State management patterns
    - Testing guidelines

13. Final verification
    - Run full test suite
    - Verify no regressions
    - Check bundle size impact
    - Deploy to staging

## Appendix

### Tailwind Classes Reference

**Colors (Dark Theme)**:
- Background: `bg-zinc-950`, `bg-zinc-900`, `bg-zinc-800`
- Borders: `border-zinc-800`, `border-zinc-700`
- Text: `text-zinc-100`, `text-zinc-200`, `text-zinc-300`, `text-zinc-400`, `text-zinc-500`, `text-zinc-600`
- Accent: `bg-blue-600`, `text-blue-400`, `border-blue-500`
- Success: `bg-emerald-600`, `text-emerald-400`
- Warning: `bg-amber-600`, `text-amber-400`
- Error: `bg-red-600`, `text-red-400`

**Spacing Scale**:
- Padding: `p-1` (4px) through `p-12` (48px)
- Margin: `m-1` through `m-12`
- Gap: `gap-1` through `gap-12`

**Typography Scale**:
- `text-xs` (12px)
- `text-sm` (14px)
- `text-base` (16px)
- `text-lg` (18px)
- `text-xl` (20px)
- `text-2xl` (24px)

**Responsive Prefixes**:
- `sm:` - 640px and up
- `md:` - 768px and up
- `lg:` - 1024px and up
- `xl:` - 1280px and up

### Animation Classes

**Transitions**:
- `transition-all` - All properties
- `transition-colors` - Color properties only
- `transition-transform` - Transform properties only
- `duration-200` - 200ms
- `duration-300` - 300ms
- `duration-400` - 400ms
- `ease-in-out` - Smooth easing

**Animations**:
- `animate-pulse` - Pulsing opacity
- `animate-spin` - Continuous rotation
- `animate-bounce` - Bouncing motion

**Custom Animations** (if needed):
```css
@keyframes slideDown {
  from { height: 0; opacity: 0; }
  to { height: auto; opacity: 1; }
}

@keyframes slideUp {
  from { height: auto; opacity: 1; }
  to { height: 0; opacity: 0; }
}
```

### Accessibility Considerations

**Keyboard Navigation**:
- All interactive elements must be keyboard accessible
- Tab order should be logical
- Focus indicators must be visible (use `focus-visible:ring-2`)

**Screen Readers**:
- Use semantic HTML (`<button>`, `<nav>`, `<section>`)
- Add `aria-label` for icon-only buttons
- Use `aria-live` for dynamic content updates (loading states, errors)
- Add `aria-hidden="true"` to decorative icons

**Touch Targets**:
- Minimum 44px × 44px for all interactive elements on mobile
- Adequate spacing between touch targets (minimum 8px)

**Color Contrast**:
- Maintain WCAG AA contrast ratios (4.5:1 for normal text, 3:1 for large text)
- Don't rely on color alone to convey information

### Performance Considerations

**Bundle Size**:
- No new heavy dependencies (only @fast-check/vitest for testing)
- Lazy load components if needed (already using React.lazy for WaveformVisualizer)
- Keep component file sizes reasonable (< 500 lines)

**Rendering Performance**:
- Use React.memo for components that don't need frequent re-renders
- Avoid unnecessary re-renders with proper dependency arrays
- Use CSS transitions instead of JavaScript animations where possible

**localStorage Performance**:
- Minimize localStorage reads/writes
- Cache localStorage values in state
- Use try-catch to handle errors gracefully

**Responsive Images** (if added):
- Use appropriate image sizes for different viewports
- Consider using WebP format with fallbacks
- Lazy load images below the fold

### Browser Compatibility

**Target Browsers**:
- Chrome/Edge: Last 2 versions
- Firefox: Last 2 versions
- Safari: Last 2 versions
- Mobile Safari: iOS 14+
- Chrome Mobile: Android 10+

**Feature Support**:
- CSS Grid: ✅ Supported in all target browsers
- Flexbox: ✅ Supported in all target browsers
- CSS Custom Properties: ✅ Supported in all target browsers
- localStorage: ✅ Supported in all target browsers
- Drag and Drop API: ✅ Supported in all target browsers
- Touch Events: ✅ Supported in mobile browsers

**Fallbacks**:
- localStorage: In-memory state if unavailable
- Drag and Drop: File input button always available
- CSS features: Tailwind handles prefixing automatically
