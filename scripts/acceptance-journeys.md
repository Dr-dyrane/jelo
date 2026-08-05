# Acceptance journeys

Browser-verified user journeys for the JeloCare refactoring (Waves 1–5).
Run `npm run dev` and verify each journey with the Playwright MCP server
or a manual browser session.

## Journey 1: Home → Products → Product detail

1. Navigate to `/`
2. Verify: page title is "Understand your skin · JeloCare"
3. Verify: "Browse products" and "Ask JeloCare" links are present
4. Click "Browse products" → navigate to `/products`
5. Verify: H1 "Browse the shelf." is rendered
6. Verify: "Fresh prices near you." DiscoveryRail section is present
7. Verify: "Care stories" region with "Start at the root." story is present
8. Verify: "Know what you see." source note is present at the bottom
9. Click a product → navigate to `/products/<slug>`
10. Verify: "Find a store" and "Details" buttons are present
11. Click "Find a store" → product quick panel dialog opens
12. Verify: dialog shows "Prices" tab panel with market data
13. Press Escape → dialog closes

## Journey 2: Consult

1. Navigate to `/consult`
2. Verify: page title is "Ask JeloCare · JeloCare"
3. Verify: H1 "What do you notice about your skin?" is present
4. Verify: ConsultExperience component is rendered below the editorial entry

## Journey 3: Me portal (authenticated)

1. Navigate to `/me`
2. Verify: redirects to `/sign-in?next=/me` (access control works)
3. After sign-in, verify: Me portal renders with dock, FAB, and view content
4. Verify: account sheet, context sheet, and product panel use shared dialog controller

## Journey 4: Concerns

1. Navigate to `/concerns`
2. Verify: page title is "Concern guides · JeloCare"
3. Verify: concern selector with multiple concern articles is present
4. Verify: each concern has a "Guide" link to `/concerns/<slug>`

## Private-safe metrics

The acceptance test suite includes a source-level contract that verifies
no customer PII (email, display name, raw profile data) is logged in
server-side modules. This ensures metrics remain private-safe.

## Running the tests

```bash
# Source-level acceptance contracts
npx tsx --test modules/acceptance/browser-evidence.test.ts

# Full release verification (includes acceptance tests)
npm run verify:release
```
