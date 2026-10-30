# Lab 4 Zen Green UI Specification

Status: Proposed for Issue #65 review. All screens/checks here are planned.
Use [specification.md](specification.md) and [api-spec.md](api-spec.md) for
rules and shapes; preserve [Lab 3 conventions](../lab-03/ui-spec.md).

## 1. Shell and design system

Reuse primary green #006B3C, secondary #0B7A46, pale #EAF6EF, page #F5F7F6,
white surfaces, readable dark text, existing Bootstrap forms/cards/badges,
restrained borders and spacing. Error red and warning amber accompany text.
Ticket status, Action status, both priorities and public/private content have
distinct labels; no meaning depends solely on color.

| Role | Navigation and initial destination after password gate |
|---|---|
| Requester | Dashboard (initial), My Tickets, Create Ticket |
| IT Staff | Dashboard (initial), Ticket Queue; reachable Ticket Detail |
| Administrator | Dashboard (initial, Staff view), Ticket Queue, User Management |

Keep identity/name/role, Logout, skip link and `aria-current=page`. Existing
destinations remain accessible. The state/callback navigation in App.tsx is
retained: Dashboard actions supply filter objects or Ticket/Action ids to the
existing views. Visible destinations use accessible controls; a new router is
not required. Direct API access is still server-authorized.

## 2. Requester Dashboard

Three labelled cards: Open Tickets, Waiting for You, Recently Resolved.
Show numeric 0 rather than a blank/dash. Each card has a clear View Tickets
action applying the exact predicate in specification section 7. Waiting for
You is the attention-required list and uses WAITING_FOR_REQUESTER.
Show up to five recently updated owned Tickets with number, summary, status,
updated time and Open Detail; View all applies returned recentFrom/asOf.
Show the snapshot time and Refresh; explain Recently Resolved covers the last
seven days and excludes legacy records with an unknown resolution date.
Create Ticket remains available. Never duplicate the entire My Tickets table.

## 3. Staff and Administrator Dashboard

Cards: Unassigned Tickets, My Tickets, My Pending Actions. Compact status
breakdown includes all eight buckets (all Tickets); IT Priority breakdown
includes four buckets (active Tickets). Visible captions distinguish these
scopes. Cards/buckets open Queue or the My Pending Actions list with exactly
the backend filters, including active status scope and session user id.

Show up to five My Pending Actions, five urgent active Tickets and five recently
updated Tickets. Action entries display Ticket number, description excerpt,
Action status and updated time; Open Action loads operational Detail, selects
Actions Taken and focuses that Action. View all My Pending Actions uses the
paginated `/api/staff/actions-taken` list. Assignment, not original performer,
defines this list. Admin sees their own assignments, not another Staff user's.
Reuse the Staff Dashboard for Admin; no extra account analytics.

### Dashboard modes and refresh

Initial/loading: descriptive status and non-actionable placeholders. Success:
consistent snapshot, counts and lists. Empty: zeros plus meaningful section
messages (e.g. No pending Actions assigned to you). No-results belongs to
drill-down filtered lists, not an absent Dashboard. Forbidden: safe role
message, no cached data. Failure: safe error and Retry, preserving the last
successful snapshot only if visibly labelled as older data. A 401 clears data
and returns to login. Ignore stale responses after identity/view changes;
reload on entry, Refresh and successful relevant writes. Do not mix new cards
with old lists from different responses.

## 4. Actions Taken in Ticket Detail

Add a clearly titled Actions Taken area to both operational and Requester
Detail. Display all Actions with paging, including completed/cancelled work,
ordered actionAt ASC,id ASC. Fields: Action date/time, description, result,
Performed by (automatic original creator), Assigned to, status, follow-up flag
and note, attachment notes, created/updated time and revision number. Render
text literally; use Internal Notes for private material. A different assignee
does not change performer or primary Ticket Owner.

Staff/Admin: Add Action, View/Edit, Reassign, Start, Complete, Cancel as permitted.
Requester: read-only all Actions and View History; no write controls or private
notes. Existing Ticket information, comments, attachment downloads and advisory
resolution remain. Read-only versus editable fields are visibly different.

### Create/edit forms and lifecycle

- Label Action Date/Time, Description, Result, Assigned to, Follow-Up Required?,
  Follow-up Note and Attachment Notes. Date defaults to now, displayed in
  Asia/Bangkok and serialized with the correct UTC offset; format and limits
  match BR-04/05. Created time and Performed by are read-only server values.
- Assignee picker reuses `/api/staff/assignees`, defaulting to the current user
  on create; no Requester/inactive choice or Action Unassign button. Reference
  loading/failure has its own retry state and does not submit an incomplete form.
- Follow-up true reveals a required Note; false clears the value only after
  user confirmation if a non-empty draft would be discarded. Submission sends
  null when false. Descriptive corrections to completed Actions stay available,
  including clearing settled follow-up and correcting the assignee; status stays read-only.
- PLANNED offers Start/Complete/Cancel; IN_PROGRESS offers Complete/Cancel.
  Complete collects a non-empty Result and optional follow-up/note. Cancel
  collects a 5-500 character reason and explicit confirmation. CANCELLED is
  read-only. On terminal parent Ticket all Action mutations are disabled with
  explanation to reopen first; API enforcement remains necessary.
- If an existing assignee became inactive/ineligible, show that state, offer
  valid reassignment for pending/completed Actions and permit Cancel for pending
  Actions. Reassign before correcting descriptive fields when the old assignee
  is ineligible. No history identity is rewritten by account changes.
- Attachment Notes reference existing files as text. Staff/Admin keep existing
  download permission; no new upload/remove controls are added.

### History and stable ordering

View History pages Action revisions by version, showing operation, actor,
timestamp and prior values. Corrections appear as additional entries; no
overwrite/delete control. A shared Ticket Status History area shows ordered
from/to status events, actor and timestamp, with no Internal Notes. Explain
that legacy history predating Lab 4 was not reconstructed. Preserve focus when
opening/closing history or moving pages; updating actionAt may move the Action
to its new correct order, so focus the saved Action by id afterward.

## 5. Workflow and resolution feedback

Offer only permitted next Ticket states from the eight-state matrix. Show a
Resolution readiness summary based on the server gate: completed work count,
pending work and unsettled follow-up. Disabled Resolve explains the failed
predicate; direct API 409 remains possible after another user changes work.
Requester advisory resolution is clearly labelled and never presented as the
formal Resolve/Close action. Closed/Cancelled Ticket confirmation is distinct
from cancelling an Action.

On success use the returned Ticket timestamp/Action version, refresh summary,
Action list/gate and any active Dashboard. On 409 preserve the draft, clear
prior confirmations and offer Load Latest. Show new server values separately
from the user's unsaved form; never silently replace the draft or auto-submit
it with refreshed versions. Require review/reconfirmation before a new attempt.
Legacy zero-Action active Tickets explain that completed work must first be
recorded; existing RESOLVED/CLOSED legacy Tickets retain their state.

## 6. Shared form and failure states

Loading, saving, validation, success, empty/no-results, forbidden, not-found,
conflict and safe network/500 failure are distinct where applicable. Saving
disables repeat submission. Maintain one UUID per command through ambiguous
network retries; changed drafts/new commands get new ids. A replay prompts a
fresh load because saved versions can be old. Failed submit preserves text,
assignee and dates. Do not clear important form values on 400/409/500/network
failure; cancel/navigation with unsaved work requests discard confirmation.
On logout or user change clear prior-user data and drafts. Guard asynchronous
responses so an old screen/user request cannot replace current content.

Errors sit beside the field/action, linked with aria-describedby; saving and
success use a polite status region, safe failure an alert. Accessible dialogs
trap focus, name the Ticket/Action and return focus to their trigger. Destructive
actions are separated from Save/Complete and state exactly what is being cancelled.

## 7. Responsive layout and accessibility

1280px: compact metric grid and readable lists, operational controls grouped
apart from shared/private collaboration. 820px: wrap cards/controls and avoid
dense horizontal tables. 390px: one-column cards, stacked Action rows, full-width
labelled fields and reachable actions; long descriptions/notes wrap. No page
horizontal overflow, clipped badges, hidden buttons or inaccessible dialogs.
Use visible keyboard focus, semantic headings/labels, non-color status text,
accessible metric/action names and standard keyboard activation.

### Planned visual and accessibility checklist

- [ ] All roles preserve identity, active Dashboard navigation and earlier screens.
- [ ] Green tokens, spacing, forms, buttons, Ticket/Action/priority badges agree.
- [ ] Dashboard labels, counts, scope captions and drill-downs match the API.
- [ ] My Actions means current assignee; zero/loading/forbidden/failure states work.
- [x] Actions list/create/reassign/edit/start/complete/cancel/history are usable.
- [x] Performed by, Ticket Owner and Assigned to are clearly distinguished.
- [x] Requester Action view is read-only and never exposes Internal Notes.
- [ ] Required fields, errors, inactive assignee and gate failure are clear.
- [ ] Conflict/retry preserves draft and clears stale confirmations.
- [ ] Keyboard order, focus restoration, labels and announcements are verified.
- [ ] Every major screen at 1280/820/390px has no clipping/overlap/page overflow.
- [ ] No unintended console errors, broken links, placeholder or unfinished controls.

Keep unchecked until verified. Screenshot root is
`artifacts/lab-04/screenshots/{staff-dashboard,requester-dashboard,actions-taken}/`.
In #72, add a captioned index naming role, viewport, fixture/state, query evidence
and Answer Part; include workflow/regression evidence under the relevant group.
