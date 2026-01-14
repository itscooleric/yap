# Chat Feature Design - Documentation Index

This directory contains the complete UI/UX design specifications for the new Chat feature in Yap.

## 📚 Documents

### 1. [CHAT_UI_DESIGN.md](./CHAT_UI_DESIGN.md) - Main Design Document
**Size**: ~3,300 words | ~785 lines

The comprehensive design document covering:
- **Overview & Design Goals** - Philosophy and objectives
- **Core Workflows** - Step-by-step user journeys
- **Wireframes** - 5 detailed ASCII wireframes showing key screens
- **UI Components** - Specification of 8 major components
- **Interaction Flows** - State machines and user flows
- **Responsive Design** - Mobile, tablet, and desktop layouts
- **Accessibility** - Keyboard navigation, screen reader support
- **Error Handling** - Patterns and user messaging
- **Settings & Config** - LLM provider configuration
- **Export Format** - Markdown template for conversation exports
- **Performance** - Optimization strategies and resource limits
- **Visual Design Tokens** - Colors, typography, spacing
- **Implementation Notes** - Component reuse and new components to build

**Start here for the big picture.**

---

### 2. [CHAT_UI_COMPONENTS.md](./CHAT_UI_COMPONENTS.md) - Component Specifications
**Size**: ~2,400 words | ~1,016 lines

Detailed technical specifications for implementation:
- **Component Hierarchy** - Tree structure showing relationships
- **9 Detailed Components** - Complete HTML/CSS/JS specs including:
  - ChatTab (main container)
  - ChatHeader (with message count)
  - MessageListContainer (scrollable)
  - EmptyState (zero messages)
  - MessageBubble (User) - with audio player
  - MessageBubble (Assistant) - with loading state
  - NewMessagePanel (recording/text input)
  - Settings Integration (LLM configuration)
  - Mobile FAB (Floating Action Buttons)
- **Event System** - Custom event names and patterns
- **State Management** - chatState object schema
- **Message Schema** - Data structure for messages
- **Testing Checklist** - Visual, interaction, responsive, a11y tests

**Use this for implementation details.**

---

### 3. [CHAT_UI_STATES.md](./CHAT_UI_STATES.md) - Visual State Reference
**Size**: ~3,550 words | ~763 lines

ASCII mockups showing every possible UI state:
- **State 1**: Initial Load (Empty) - First visit experience
- **State 2**: Recording Audio - During voice recording
- **State 3**: Transcribing Audio - Processing speech-to-text
- **State 4**: Ready to Send - Transcript complete, awaiting user action
- **State 5**: Sending to LLM - Request in progress
- **State 6**: Conversation Active - Multiple messages displayed
- **State 7**: Text Input Mode - Alternative to voice recording
- **State 8**: Error State - Handling failures gracefully
- **State 9**: Mobile View - Responsive layout <600px
- **State 10**: Export Dialog - Conversation export flow
- **State Transitions** - Diagram showing all state changes
- **Keyboard Shortcuts** - Reference table for power users

**Reference this during development to match exact UI states.**

---

## 🎨 Design Principles

All designs follow these core principles from Yap's existing codebase:

1. **Dark Terminal Aesthetic**
   - Background: `#1a1a2e` (primary), `#16213e` (secondary), `#0f3460` (tertiary)
   - Text: High contrast white/cyan on dark
   - Accent: `#ff2975` (pink) for user messages
   - Secondary accent: `#00fff9` (cyan) for assistant messages

2. **Minimal Clutter**
   - Clean panels with subtle borders
   - Generous whitespace
   - Information hierarchy through size and color
   - Progressive disclosure (show actions on hover)

3. **Component Reuse**
   - Leverage existing ASR recording component
   - Reuse export panel logic
   - Extend settings panel patterns
   - Use established button and input styles

4. **Responsive by Default**
   - Mobile-first approach
   - Floating Action Buttons for mobile
   - Flexible layouts that adapt to viewport
   - Touch-friendly targets (44x44px minimum)

5. **Accessibility First**
   - WCAG AA color contrast
   - Keyboard navigation
   - Screen reader support
   - Focus indicators
   - Semantic HTML

---

## 🚀 Quick Navigation

### For Product/Design Review
Start with [CHAT_UI_DESIGN.md](./CHAT_UI_DESIGN.md) sections:
- Overview and Design Goals
- Core Workflows
- Wireframes

### For Frontend Implementation
1. Read [CHAT_UI_COMPONENTS.md](./CHAT_UI_COMPONENTS.md) for component specs
2. Reference [CHAT_UI_STATES.md](./CHAT_UI_STATES.md) while coding to match states
3. Use [CHAT_UI_DESIGN.md](./CHAT_UI_DESIGN.md) Visual Design Tokens for styling

### For Backend Integration
See [CHAT_UI_DESIGN.md](./CHAT_UI_DESIGN.md) sections:
- Backend Requirements (LLM Proxy Service)
- Settings & Configuration
- Export Format

### For QA/Testing
1. [CHAT_UI_COMPONENTS.md](./CHAT_UI_COMPONENTS.md) - Testing Checklist
2. [CHAT_UI_STATES.md](./CHAT_UI_STATES.md) - All states to verify
3. [CHAT_UI_DESIGN.md](./CHAT_UI_DESIGN.md) - Interaction Flows

---

## 📊 Design Summary Stats

- **Total Documentation**: 9,280 words across 3 documents
- **Wireframes/Mockups**: 15+ detailed ASCII diagrams
- **UI Components Specified**: 9 major components
- **UI States Documented**: 10 complete states
- **Code Examples**: HTML, CSS, JavaScript snippets throughout
- **Test Cases**: 40+ specific test scenarios

---

## 🔗 Related Documentation

- [User Guide](./USER_GUIDE.md) - Existing Yap features (ASR, TTS)
- [Mobile Guide](./MOBILE.md) - Mobile/tablet patterns
- [Export Guide](./EXPORT.md) - Export mechanisms to reuse
- [Data Guide](./DATA.md) - Metrics integration for chat

---

## 📝 Implementation Checklist

Use this checklist when building the Chat feature:

### Phase 1: Core UI Structure
- [ ] Create `app/ui/js/chat.js` module following tab pattern
- [ ] Add Chat tab button to `app/ui/index.html` nav
- [ ] Add Chat tab content section to HTML
- [ ] Import and initialize in `app/ui/js/main.js`
- [ ] Add Chat-specific styles to `app/ui/css/styles.css`

### Phase 2: Message Components
- [ ] Build MessageBubble component (user variant)
- [ ] Build MessageBubble component (assistant variant)
- [ ] Build MessageListContainer with scroll behavior
- [ ] Build EmptyState component
- [ ] Implement message rendering and state management

### Phase 3: Input Components
- [ ] Integrate ASR recording (reuse from asr.js)
- [ ] Build waveform visualizer
- [ ] Build audio preview component
- [ ] Build text input mode
- [ ] Build mode toggle (Audio/Text)
- [ ] Add status bar with state indicators

### Phase 4: Settings Integration
- [ ] Add Chat section to Settings panel
- [ ] Add LLM endpoint configuration
- [ ] Add model, API key, temperature controls
- [ ] Add validation and test connection
- [ ] Persist settings to localStorage

### Phase 5: LLM Integration
- [ ] Create LLM proxy client module
- [ ] Implement request/response handling
- [ ] Add loading states during LLM calls
- [ ] Add error handling and retry logic
- [ ] Support markdown rendering in responses

### Phase 6: Export Integration
- [ ] Reuse export panel from export.js
- [ ] Format conversations as markdown
- [ ] Pre-fill export panel with chat content
- [ ] Test with GitLab, GitHub, SFTP, Webhook

### Phase 7: Mobile Optimization
- [ ] Add Chat FAB buttons to mobile toolbar
- [ ] Update FAB mode switching logic
- [ ] Test touch targets (44x44px minimum)
- [ ] Test responsive layout <600px

### Phase 8: Polish & Accessibility
- [ ] Add keyboard shortcuts (Ctrl+Enter, Space, etc.)
- [ ] Add ARIA labels and semantic HTML
- [ ] Test with screen reader
- [ ] Add focus indicators
- [ ] Test color contrast (WCAG AA)
- [ ] Add animations (message slide-in, etc.)

### Phase 9: Testing
- [ ] Unit tests for chat state management
- [ ] Integration tests for LLM proxy
- [ ] Visual regression tests
- [ ] Responsive design tests
- [ ] Accessibility audit
- [ ] Cross-browser testing

### Phase 10: Documentation
- [ ] Update README with Chat feature info
- [ ] Add Chat section to User Guide
- [ ] Document LLM provider setup
- [ ] Add troubleshooting section
- [ ] Update screenshots

---

## 🤝 Contributing

When implementing the Chat feature:

1. **Follow existing patterns**: Study how ASR and TTS tabs are structured
2. **Reuse components**: Don't rebuild what already exists (export, settings, recording)
3. **Match the aesthetic**: Use the documented design tokens
4. **Test thoroughly**: Use the testing checklists in the component docs
5. **Document changes**: Update this README if design decisions change

---

## 📞 Questions?

For design clarification or implementation guidance, refer to:
- [.github/prompts/new-tab.md](../.github/prompts/new-tab.md) - Tab creation pattern
- [.github/agents/chat-feature.agent.md](../.github/agents/chat-feature.agent.md) - Chat agent instructions
- Existing tab implementations: `app/ui/js/asr.js`, `app/ui/js/tts.js`

---

**Last Updated**: 2026-01-14  
**Version**: 1.0  
**Status**: ✅ Complete - Ready for Implementation
