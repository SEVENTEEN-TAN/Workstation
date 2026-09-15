# Admin Experience Foundation Design

## Status

Proposed for review. This specification covers iteration V1.1 only.

## Purpose

Create a coherent Dark Studio administration foundation before rebuilding the homepage CMS and OKR workflows. This iteration improves entry, navigation, state feedback, and responsive behavior while preserving all existing business operations and public pages.

## Scope

The iteration contains three related capabilities:

1. A branded administrator login page based on the approved Dark Studio direction.
2. Route-addressable administration modules inside a shared admin shell.
3. Reusable feedback and confirmation patterns for later CMS and OKR work.

The homepage CMS remains a JSON editor in this iteration. The OKR page retains its existing CRUD layout and behavior. Their full redesigns are separate V1.2 and V1.3 specifications.

## Information Architecture

The admin area will use these routes:

- `/admin`: redirect to `/admin/overview`.
- `/admin/overview`: dashboard metrics and recent goal progress.
- `/admin/home`: current homepage CMS.
- `/admin/okr`: current OKR manager.
- `/admin/media`: current media manager.
- `/admin/login`: administrator login.
- `/admin/setup`: first-administrator setup.

Each authenticated route renders inside the same server-guarded admin layout. Navigation state derives from the current route instead of local component state, so browser back, refresh, and direct links preserve context.

## Login Experience

The login page uses a two-region composition on wide screens:

- The identity region presents `SEVENTEEN / PERSONAL WORKSTATION`, `PRIVATE CONTROL.`, the workstation purpose, and the existing engineering identity.
- The access region contains the username and password form.

On compact screens the identity region becomes a concise header above the form. The form provides persistent labels, password visibility control, stable button dimensions, keyboard submission, and an inline alert region.

Existing authentication behavior remains unchanged:

- No registration entry is introduced.
- Invalid credentials use a generic error.
- Login throttling remains active.
- The submit button is disabled and displays progress while a request is running.
- Successful login redirects to `/admin/overview`.

## Admin Shell

The shell contains:

- A persistent brand area.
- Primary navigation for Overview, Homepage, OKR, and Media.
- A page header with eyebrow, title, optional description, page actions, and a breadcrumb slot that stays hidden on first-level pages.
- An account area with the administrator name and logout action.
- A constrained content workspace that supports dense forms without nesting page sections inside decorative cards.

Viewports at or above 1024 CSS pixels use a left navigation rail. Narrower viewports use a compact top bar and an accessible navigation menu. Verification covers widths of 390, 768, 900, 1024, and 1440 CSS pixels.

## Module Migration

The existing `AdminWorkspace` behavior will be divided by responsibility:

- The dashboard view moves to the Overview route.
- Site draft and version behavior moves to the Homepage route.
- OKR state and operations move to the OKR route.
- Asset upload and listing move to the Media route.
- Shared request, navigation, header, feedback, and confirmation behavior moves into focused shared modules.

The API routes, Prisma schema, public homepage, public OKR page, authentication model, and stored data remain unchanged in V1.1.

## Feedback Model

Every mutation uses the same lifecycle:

1. Idle: the action is available.
2. Submitting: the initiating control is disabled and its label or icon communicates progress.
3. Success: a viewport-visible status message identifies the completed action and dismisses after four seconds unless it contains a follow-up action.
4. Failure: a viewport-visible alert provides a useful recovery message and remains until dismissed or superseded; field-specific errors remain near their fields.

Page-level data loading uses stable skeleton regions where content already has a predictable shape. An empty state describes what is missing and exposes one relevant next action. Refresh actions cannot run concurrently with themselves.

Destructive actions use a shared confirmation dialog that names the record and describes known related-data impact. The existing generic browser confirmation will be replaced only where the migrated modules currently expose deletion.

## Accessibility And Interaction

- All icon-only buttons have accessible names and tooltips.
- Navigation exposes the current page through `aria-current`.
- Alerts use `role="alert"`; nonurgent success messages use `role="status"`.
- Dialog focus moves into the dialog, remains trapped while open, and returns to the invoking control on close.
- Touch targets remain at least 40 by 40 CSS pixels.
- Keyboard focus remains visible against every admin surface.
- Motion respects the operating-system reduced-motion preference.

## Error Handling

- A `401` response redirects to login and preserves a return path only when it begins with `/admin/` and is not `/admin/login` or `/admin/setup`.
- Validation errors display next to the related field when the API returns issue paths.
- Network and unexpected errors produce a general alert without discarding user-entered form data.
- Logout failure leaves the current session UI intact and reports the failure.
- Route-level failures render a retryable admin error state rather than a blank workspace.

## Testing And Acceptance

### Unit And Component Tests

- Resolve the active navigation item from each admin route.
- Render submitting, success, failure, and empty states.
- Prevent duplicate action submission.
- Preserve generic credential-error behavior and login throttling messages.

### Integration Tests

- Unauthenticated access to every admin module redirects to login.
- Successful login reaches `/admin/overview`.
- A saved return path restores the originally requested module after login.
- Existing dashboard, site draft, publish, version, OKR, and media APIs remain usable from their migrated pages.

### Browser Tests

- Complete login, navigation, refresh, logout, and session-expiry flows.
- Verify browser back and direct-route reload behavior.
- Verify admin shell layout at desktop, tablet, and mobile viewports.
- Verify loading, success, failure, empty, and destructive-confirmation states.
- Confirm the public homepage and public OKR visuals are unchanged.

## Out Of Scope

- Structured homepage forms and live preview layout.
- New homepage content models.
- OKR master-detail workspace and Action Items.
- Media editing, replacement, reference tracking, and deletion.
- Obsidian synchronization.
- GitHub and AI integrations.

## Implementation Boundary

This iteration may reorganize the current admin UI into focused route modules and shared admin components. It must not change persisted content, public query behavior, OKR calculations, authentication rules, or the existing public visual baseline.
