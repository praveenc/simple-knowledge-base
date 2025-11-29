---
title: "Frontend Development with Cloudscape"
inclusion: fileMatch
fileMatchPattern: ['frontend/**/*.tsx', 'frontend/**/*.ts', 'frontend/**/*.jsx', 'frontend/**/*.js']
---

# Frontend Development

## Documentation-First Rule

- ALWAYS search `docs/cloudscape-docs/components/` before implementing/modifying Cloudscape components
- Reference `docs/cloudscape-docs/CLOUDSCAPE_FOUNDATIONS.md` for design tokens, spacing, layout
- Check `docs/cloudscape-docs/CLOUDSCAPE_REACT_A_PRIMER.md` for React patterns and event handling
- Never assume component APIs - search documentation first

## Cloudscape Principles

- Use design tokens for colors, spacing, typography (never hard-code values)
- All form components must be controlled with React state
- Use `({ detail }) => ...` event pattern for all Cloudscape events
- Compose with `SpaceBetween`, `Box`, layout components (avoid manual margins/padding)
- Preserve built-in accessibility features

## Project Patterns

- API client in `src/api/client.ts`, types in `src/api/types.ts`
- React hooks only (`useState`, `useCallback`, `useEffect`)
- `Flashbar` for page-level notifications, `Alert` for inline messages
- Async/await for API calls, handle errors with try/catch

## Avoid

- Hard-coded colors, spacing, typography
- Uncontrolled form components
- Breaking accessibility
- Over-customizing component styles
- Ignoring TypeScript errors
