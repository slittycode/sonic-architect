# Implementation Plan: First-Time User Experience

## Overview

This implementation plan breaks down the first-time user experience improvements into discrete, actionable coding tasks. The approach follows a phased implementation strategy: core components first, then enhanced feedback, navigation and responsive design, and finally testing and polish. Each task builds incrementally on previous work, with checkpoints to validate progress.

The implementation is purely additive UI work that preserves all existing functionality. All new components use TypeScript with React 19, Tailwind CSS for styling, and integrate with the existing dark theme aesthetic.

## Tasks

- [ ] 1. Set up project structure and dependencies
  - Install @fast-check/vitest for property-based testing
  - Create component directories: src/components/LandingHero, src/components/FileFormatBadges, src/components/BlueprintNavigation
  - Create test directories: __tests__/components, __tests__/integration, __tests__/properties
  - Set up localStorage utility functions for first-time user tracking
  - _Requirements: 1.1, 1.4, 1.5, 7.6_

- [x] 2. Implement LandingHero component
  - [x] 2.1 Create LandingHero component with expanded and minimized states
    - Create src/components/LandingHero/LandingHero.tsx with TypeScript interfaces
    - Implement expanded state with headline, feature highlights, and CTA button
    - Implement minimized state with compact display
    - Add smooth height transition animations (300ms ease-in-out)
    - Use Tailwind classes for dark theme styling (zinc-*, blue-*)
    - Implement responsive typography (mobile: smaller text, desktop: larger text)
    - _Requirements: 1.1, 1.2, 1.3, 1.6, 6.6_
  
  - [ ]* 2.2 Write unit tests for LandingHero
    - Test expanded state rendering
    - Test minimized state rendering
    - Test dismiss action
    - Test responsive text classes at different viewport widths
    - _Requirements: 1.1, 1.5, 6.6_
  
  - [ ]* 2.3 Write property test for LandingHero theme consistency
    - **Property 4: Dark theme color consistency**
    - **Validates: Requirements 1.6, 7.1**

- [x] 3. Implement localStorage integration for first-time user tracking
  - [x] 3.1 Create localStorage utility module
    - Create src/utils/firstTimeUser.ts with FirstTimeUserState interface
    - Implement getFirstTimeUserState() function with try-catch error handling
    - Implement setFirstTimeUserState() function with QuotaExceededError handling
    - Implement markAnalysisComplete() function to update state
    - Add in-memory fallback for when localStorage is unavailable
    - _Requirements: 1.1, 1.4, 1.5_
  
  - [ ]* 3.2 Write unit tests for localStorage utilities
    - Test getFirstTimeUserState with valid data
    - Test getFirstTimeUserState with missing data
    - Test setFirstTimeUserState success
    - Test error handling for localStorage unavailable
    - Test error handling for quota exceeded
    - _Requirements: 1.1, 1.4, 1.5_
  
  - [ ]* 3.3 Write property tests for first-time user state management
    - **Property 1: First-time user hero display**
    - **Property 2: Hero state transition on analysis completion**
    - **Property 3: Returning user hero state**
    - **Validates: Requirements 1.1, 1.4, 1.5**

- [x] 4. Update App.tsx with first-time user state management
  - [x] 4.1 Add state management to App.tsx
    - Add isFirstTimeUser state using useState hook
    - Add showHero state derived from isFirstTimeUser
    - Load first-time user state on component mount using useEffect
    - Integrate LandingHero component above upload section
    - Pass onDismiss handler to LandingHero that calls markAnalysisComplete()
    - Update hero state after successful analysis completion
    - _Requirements: 1.1, 1.4, 1.5, 1.7_
  
  - [ ]* 4.2 Write integration test for first-time user flow
    - Test: Load app → hero displays expanded → upload file → analysis completes → hero minimizes → localStorage updated
    - _Requirements: 1.1, 1.4, 1.5_

- [x] 5. Create FileFormatBadges component
  - [x] 5.1 Implement FileFormatBadges component
    - Create src/components/FileFormatBadges/FileFormatBadges.tsx
    - Accept formats prop as string array
    - Render pill-shaped badges with zinc-800 background, zinc-400 text
    - Implement responsive wrapping (flex-wrap on mobile, inline on desktop)
    - Use Tailwind spacing and typography classes
    - _Requirements: 2.3, 7.2, 7.3_
  
  - [ ]* 5.2 Write unit tests for FileFormatBadges
    - Test badge rendering for all supported formats
    - Test responsive wrapping behavior
    - _Requirements: 2.3_

- [x] 6. Enhance UploadZone component with drag-drop feedback
  - [x] 6.1 Add drag-and-drop visual feedback to UploadZone
    - Add isDragOver state using useState
    - Add dragError state for validation errors
    - Implement onDragEnter, onDragOver, onDragLeave, onDrop handlers
    - Add file type validation (WAV, MP3, FLAC, OGG, AAC, M4A)
    - Add file size validation (max 100MB)
    - Update border and background colors based on drag state (blue-500 for valid, red-500 for invalid)
    - Display error messages for invalid file type or size exceeded
    - Integrate FileFormatBadges component to show supported formats
    - Ensure minimum 44px tap targets for mobile
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 6.2, 6.7_
  
  - [ ]* 6.2 Write unit tests for UploadZone enhancements
    - Test drag-over visual feedback for valid files
    - Test drag-over visual feedback for invalid files
    - Test error message display for unsupported file type
    - Test error message display for file size exceeded
    - Test error clearing on next valid file
    - Test FileFormatBadges integration
    - _Requirements: 2.2, 2.5, 2.6_
  
  - [ ]* 6.3 Write property tests for UploadZone validation
    - **Property 5: Drag-over visual feedback**
    - **Property 6: Invalid file error handling**
    - **Validates: Requirements 2.2, 2.5, 2.6**

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Enhance ProviderSelector with badges and setup links
  - [x] 8.1 Add badges and setup links to ProviderSelector
    - Add "Free" badge to Local DSP option (emerald-600 background, emerald-400 text)
    - Add "Enhanced" badge to Gemini and Ollama options (blue-600 background, blue-400 text)
    - Emphasize "No API key needed" text for Local DSP
    - Add conditional setup links for Gemini (API key configuration)
    - Add conditional setup links for Ollama (local server configuration)
    - Display setup links only when provider is selected but not available
    - Improve visual hierarchy with icons and spacing
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  
  - [ ]* 8.2 Write unit tests for ProviderSelector enhancements
    - Test "Free" badge display on Local DSP
    - Test "Enhanced" badge display on Gemini and Ollama
    - Test setup link display when Gemini selected but unavailable
    - Test setup link display when Ollama selected but unavailable
    - Test setup link hidden when provider is available
    - _Requirements: 3.2, 3.4, 3.5, 3.6_
  
  - [ ]* 8.3 Write property test for provider setup links
    - **Property 7: Provider setup link display**
    - **Validates: Requirements 3.5, 3.6**

- [ ] 9. Enhance AnalysisStateDisplay with smooth transitions
  - [ ] 9.1 Add smooth state transitions to AnalysisStateDisplay
    - Add fade-in animation for loading state (200ms)
    - Add fade-out animation for state changes (100ms)
    - Add animated spinner using Tailwind animate-spin
    - Display provider-specific messages during analysis
    - Add smooth transition to results (400ms)
    - Enhance error state with retry button
    - Ensure loading state appears within 50ms of state change
    - Ensure loading state removes within 100ms of completion
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 8.3, 8.4, 8.5_
  
  - [ ]* 9.2 Write unit tests for AnalysisStateDisplay transitions
    - Test loading state display
    - Test transition timing (200ms fade-in, 100ms fade-out)
    - Test error state with retry button
    - Test provider-specific messages
    - _Requirements: 4.2, 4.4, 4.5, 4.6_
  
  - [ ]* 9.3 Write property tests for state transitions
    - **Property 8: Upload to analyzing state transition**
    - **Property 9: Loading state display during analysis**
    - **Property 10: Analysis completion state transition**
    - **Property 11: Analysis error handling**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.5, 4.6, 8.3**

- [ ] 10. Add empty states to UploadZone and SessionMusician
  - [ ] 10.1 Implement empty state for UploadZone
    - Add empty state message with upload instructions
    - Display when no file has been uploaded
    - Use zinc-600 text color for subtle appearance
    - _Requirements: 8.1_
  
  - [ ] 10.2 Implement empty state for SessionMusician
    - Add empty state message explaining MIDI transcription feature
    - Display when no analysis data is available
    - Use consistent styling with UploadZone empty state
    - _Requirements: 8.2_
  
  - [ ]* 10.3 Write property test for empty state display
    - **Property 17: Empty state display**
    - **Validates: Requirements 8.1, 8.2**

- [ ] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Create BlueprintNavigation component
  - [x] 12.1 Implement BlueprintNavigation component
    - Create src/components/BlueprintNavigation/BlueprintNavigation.tsx
    - Define NavigationSection interface with id, label, icon, ref
    - Create navigation sections: Telemetry (Activity), Arrangement (Clock), Instruments (Layers), FX (Settings2), Secret Sauce (Sparkles)
    - Implement sticky navigation bar below blueprint header
    - Add smooth scroll to section on click (300ms duration)
    - Implement active section highlighting
    - Add horizontal scroll for mobile viewports
    - Use Lucide React icons for section icons
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  
  - [ ]* 12.2 Write unit tests for BlueprintNavigation
    - Test all five sections render with correct labels and icons
    - Test click handler triggers scroll
    - Test active section highlighting
    - Test horizontal scroll on mobile
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  
  - [ ]* 12.3 Write property test for blueprint navigation
    - **Property 12: Blueprint navigation rendering**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**

- [x] 13. Integrate BlueprintNavigation into BlueprintDisplay
  - [x] 13.1 Add BlueprintNavigation to BlueprintDisplay component
    - Import BlueprintNavigation component
    - Create refs for each blueprint section (telemetry, arrangement, instruments, fx, secretSauce)
    - Pass section data and scroll handler to BlueprintNavigation
    - Position navigation below blueprint header
    - Ensure navigation is sticky during scroll
    - _Requirements: 5.1, 5.7_
  
  - [ ]* 13.2 Write integration test for blueprint navigation
    - Test: Render blueprint → navigation displays → click section → smooth scroll to section
    - _Requirements: 5.1, 5.7_

- [x] 14. Implement responsive design across all components
  - [x] 14.1 Add mobile-first responsive classes to all components
    - Apply single-column layout for viewports < 768px
    - Apply two-column layout for viewports 768px-1024px
    - Apply multi-column desktop layout for viewports > 1024px
    - Ensure all interactive elements have minimum 44px tap targets on mobile
    - Add responsive typography classes (text-sm on mobile, text-base on tablet, text-lg on desktop)
    - Add responsive spacing classes (p-4 on mobile, p-6 on tablet, p-8 on desktop)
    - Test layout adaptation at breakpoints: 320px, 768px, 1024px, 1280px
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.3_
  
  - [ ]* 14.2 Write unit tests for responsive behavior
    - Test single-column layout at 320px viewport
    - Test two-column layout at 768px viewport
    - Test desktop layout at 1280px viewport
    - Test touch target sizes on mobile
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [ ]* 14.3 Write property tests for responsive design
    - **Property 13: Responsive layout adaptation**
    - **Property 14: Touch-friendly mobile controls**
    - **Property 15: Hero responsive typography**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.6**

- [ ] 15. Ensure Tailwind-only styling across all components
  - [ ] 15.1 Audit and refactor styling to use only Tailwind classes
    - Review all new components for inline styles or custom CSS
    - Replace any inline styles with Tailwind utility classes
    - Ensure consistent spacing using Tailwind spacing scale (p-*, m-*, gap-*)
    - Ensure consistent typography using Tailwind typography scale (text-*)
    - Verify all colors use dark theme palette (zinc-*, blue-*, emerald-*, red-*)
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [ ]* 15.2 Write property test for Tailwind-only styling
    - **Property 16: Tailwind-only styling**
    - **Validates: Requirements 7.2, 7.3, 7.4**

- [ ] 16. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Run full test suite and verify coverage
  - [ ] 17.1 Run all unit tests and property-based tests
    - Execute vitest test suite
    - Verify all 17 correctness properties pass with 100+ iterations
    - Check test coverage for all new components
    - Fix any failing tests
    - _Requirements: All_
  
  - [ ] 17.2 Verify no regressions in existing functionality
    - Test existing upload flow still works
    - Test existing provider selection still works
    - Test existing blueprint display still works
    - Test existing SessionMusician still works
    - Ensure all existing features preserved
    - _Requirements: 7.5_

- [ ] 18. Final polish and accessibility verification
  - [ ] 18.1 Verify accessibility compliance
    - Test keyboard navigation for all interactive elements
    - Verify focus indicators are visible (focus-visible:ring-2)
    - Add aria-label to icon-only buttons
    - Add aria-live to dynamic content (loading states, errors)
    - Add aria-hidden="true" to decorative icons
    - Test with keyboard-only navigation
    - _Requirements: 6.2, 7.1_
  
  - [ ] 18.2 Performance optimization
    - Check bundle size impact (should be minimal)
    - Verify loading state appears within 50ms
    - Verify state transitions complete within specified durations (200-400ms)
    - Optimize any slow-rendering components with React.memo if needed
    - _Requirements: 1.7, 4.4, 8.4, 8.5_

- [ ] 19. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at reasonable breaks
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All implementation preserves existing functionality (purely additive)
- All styling uses Tailwind CSS classes only (no custom CSS or inline styles)
- All components use TypeScript with React 19 hooks (useState, useEffect)
- localStorage integration includes error handling and in-memory fallback
