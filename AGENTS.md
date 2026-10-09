## Development Rules

- Read the existing codebase before making changes. Reuse its architecture and dependencies.
- Follow the installed design skill. Define the visual direction, design tokens, responsive layout, and component states before implementation.
- Build mobile-first. Support touch input, keyboard navigation, loading states, empty states, errors, and offline behaviour.
- For PWA features, verify the manifest, icons, service-worker registration, cache invalidation, and update flow.
- Never assume a feature works because the code compiles. Run the build, type checks, linting, and relevant tests.
- Use Playwright to test important user flows on mobile and desktop viewports.
- Protect secrets, validate inputs, and check Supabase Row Level Security policies. Never expose service-role keys in client-side code.
- Avoid unnecessary dependencies, duplicated components, placeholder functionality, and unrelated refactoring.
- Report the commands run, test results, failures, and remaining limitations honestly.