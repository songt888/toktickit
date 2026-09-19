# Lab 3 Zen Green UI Specification

Status: Draft for Issue 1 peer review

## 1. Design System

Lab 3 extends the Lab 2 Zen Green visual system. Existing color, spacing,
typography, form, card, badge, button, validation, and responsive tokens remain
the source of truth.

| Token | Use |
|---|---|
| Primary green `#006B3C` | Application header and primary actions |
| Secondary green `#0B7A46` | Links, active controls, and focus accents |
| Pale green `#EAF6EF` | Success, selected, and supportive sections |
| Page background `#F5F7F6` | Application background |
| Surface `#FFFFFF` | Cards, forms, tables, and panels |
| Charcoal green text | Headings and body copy |
| Dark red | Errors, invalid fields, and destructive warnings |
| Amber | Warnings and attention states |

Use restrained borders and shadows. Do not communicate meaning by color alone.

## 2. Authenticated Application Shell

The header shows the TokTickIT identity, the current user's name, the current
role badge, and Logout. Navigation is role-specific:

| Role | Navigation |
|---|---|
| Requester | My Tickets, Create Ticket |
| IT Staff | Ticket Queue, accessible Ticket Detail |
| Administrator | User Management, Ticket Queue, accessible Ticket Detail |

The active navigation item has a visible style and `aria-current="page"`.
Unauthorised destinations are not shown, but the backend still protects direct
URL and API access. On mobile, navigation remains keyboard reachable and does
not create horizontal scrolling.

## 3. Login Screen

### Structure

- TokTickIT heading and short sign-in explanation.
- Email input with visible label.
- Password input with visible label and accessible show/hide control if used.
- Sign In button with visible text.
- Safe error region for invalid credentials or inactive accounts.

### Modes and feedback

- Initial: empty fields and enabled Sign In.
- Validation: field-level messages for missing or malformed values.
- Submitting: button disabled with a text busy indicator.
- Failure: safe message such as `Unable to sign in. Check your details and try again.`
- Success: continue to the application or Change Password screen.

The UI must not state whether a particular email exists or is inactive.

## 4. Change Password Screen

The screen is mandatory when the authenticated user has an initial password.
Show current password, new password, confirm password, password rules, and a
Continue button.

- The normal application shell and protected destinations remain unavailable
  until success.
- New password rules are visible before submission.
- Validation is placed beside the relevant control.
- The save button has a busy state and prevents duplicate submission.
- Success continues to the role-specific application.
- Failure preserves entered values except password values when security policy
  requires clearing them.

## 5. Requester Screens

The Lab 2 screens continue using the authenticated Requester identity. Remove
the Development Requester selector, `Change Requester` action, and client-side
requester switching state.

### My Tickets

Keep the Lab 2 API-backed list, search, filters, sorting, pagination, loading,
empty, no-results, and failure states. The list is scoped by the server to the
authenticated Requester.

### Create Ticket

Keep the Lab 2 fields, validation, generated Ticket Number, attachment flow,
and submission feedback. Do not display or submit a requester selector.

### Requester Ticket Detail

Keep read-only Ticket and Attachment information. Add:

- Public Comments list and Add Public Comment form.
- Problem Appears Resolved action with clear explanation that it does not
  formally resolve or close the Ticket.
- Loading, forbidden, not-found, validation, saving, success, and failure states.

Requester detail must never display Internal Notes or staff-only controls.

## 6. IT Staff Ticket Queue

### Desktop

Use a readable table or equivalent with:

- Ticket Number
- Created Date
- Summary
- Category
- Requested Priority
- IT Priority
- Current Status
- Ticket Owner or Unassigned
- Last Updated
- Open Detail action

Search, suitable filters, sort controls, page size, pagination, and Clear
Filters stay above or beside the list without creating a mega-grid.

### Tablet and mobile

At smaller widths, use stacked cards or grouped rows. Preserve all important
values and the Open Detail action. Search and filters may stack vertically.
No control may be clipped or hidden behind another element.

### Queue states

- Loading: visible status message or skeleton.
- Empty: no Tickets exist in the queue.
- No-results: Tickets exist but current query matches none.
- Forbidden: safe message for a non-operational role.
- Failure: safe retryable API message.

## 7. IT Staff Ticket Detail

Group the screen into Ticket information, operational controls, comments/notes,
and attachments.

### Read-only Ticket information

Show Ticket Number, date, requester, category, related system, summary,
description, Requested Priority, IT Priority, current status,
Problem Appears Resolved, and timestamps. The Problem Appears Resolved value is
read-only for IT Staff; it is an indication from the Requester, not a formal
status transition.

### Editable operational fields

- Ticket owner with Claim, Reassign, and Unassign behavior.
- IT Priority.
- Status with only permitted next values.
- Confirmation for Closed and Cancelled transitions.

Requested Priority remains visibly read-only. Controls show saving, success,
validation, conflict, forbidden, not-found, and safe failure messages.

### Collaboration and attachments

Public Comments and Internal Notes are separate tabs or panels with distinct
headings, colors, explanatory text, and submit buttons. Existing attachment
metadata remains available, and IT Staff/Administrators may download active
files when they have operational access. Staff do not upload or remove files;
those actions remain available only to the owning Requester. Internal Notes
must never be shown in a Requester view.

## 8. Administrator User Management

The screen stays intentionally simple and responsive.

### User list

Show Name, Email, Role, Status, and Edit. Provide name/email search and an
optional role filter. The list has loading, empty, no-results, failure, and
forbidden states.

### Create and edit modes

Create and edit forms contain:

- Name
- Email
- One role select
- Active state
- Initial password when creating or resetting
- Save and Cancel actions

Edit mode allows name, email, role, and activation changes. A separate Set New
Initial Password action makes the next login require a password change.

Duplicate email, invalid role, invalid fields, self-deactivation, and
last-active-Administrator errors appear near the relevant action. Success is
announced without revealing a password.

## 9. Feedback and Accessibility

- Every input has a visible label and accessible name.
- Required fields use an asterisk plus text feedback.
- Error, success, busy, and forbidden messages use text and appropriate ARIA
  roles, not color alone.
- Focus indicators remain visible for keyboard users.
- Buttons have visible text; icon-only buttons have an accessible label.
- Dialogs and forms return focus predictably after close or save.
- Destructive or irreversible actions require a clear confirmation.
- Read-only fields are visibly distinct from editable fields.
- Public Comments and Internal Notes cannot be confused by layout or color.
- Tables/cards and all actions are keyboard reachable.

## 10. Responsive Rules

| Viewport | Rules |
|---|---|
| Desktop, 992px and wider | Centered shell, readable queue table, multi-column forms where useful |
| Tablet, 768-991px | Controls may wrap; queue may use grouped rows; fields remain readable |
| Mobile, under 768px | Stack controls and cards; touch-friendly actions; no horizontal page scroll |

Check all major screens at 1280px, 820px, and 390px. Verify no clipping,
overlap, hidden buttons, unreadable text, or unexpected horizontal overflow.

## 11. Required Screen Modes

| Screen | Main modes |
|---|---|
| Login | Initial, validation, submitting, safe failure, success |
| Change Password | Initial, validation, saving, failure, success |
| Requester My Tickets | Loading, empty, no-results, failure, success |
| Requester Create Ticket | Initial, loading, validation, submitting, success, failure |
| Requester Ticket Detail | Loading, not-found/forbidden, read-only success, comment states |
| Staff Queue | Loading, empty, no-results, forbidden, failure, success |
| Staff Ticket Detail | Loading, forbidden/not-found, saving, conflict, success, failure |
| User Management | Loading, empty, no-results, create/edit, validation, forbidden, failure |

## 12. Visual Checklist

- [ ] Zen Green tokens are consistent on all Lab 3 screens.
- [ ] Authenticated name and role are visible in the shell.
- [ ] Navigation is role-specific and marks the active page.
- [ ] Requested Priority, IT Priority, status, and role badges are distinct.
- [ ] Editable and read-only fields are visibly different.
- [ ] Public Comments and Internal Notes are clearly separated.
- [ ] Validation is near the relevant field or action.
- [ ] Busy, disabled, success, forbidden, and failure states are readable.
- [ ] Keyboard focus is visible and all controls are reachable.
- [ ] Desktop queue remains readable without a mega-grid.
- [ ] Tablet and mobile layouts avoid clipping and overlap.
- [ ] No major screen has unintended horizontal overflow.
- [ ] Screenshots are readable at normal zoom and grouped by submission part.
