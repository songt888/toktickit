# Lab 2 Zen Green UI Specification

## 1. Design System

| Token | Value | Use |
|---|---|---|
| Primary green | `#006B3C` | Header, primary actions, strong emphasis |
| Secondary green | `#0B7A46` | Links, active controls, focus accents, hover |
| Pale green | `#EAF6EF` | Selected, success, and subtle section emphasis |
| Page background | `#F5F7F6` | Application page background |
| Surface | `#FFFFFF` | Cards, forms, tables |
| Text | Dark charcoal-green | Body text and headings |
| Error | Dark red | Error borders, messages, non-color indicator |
| Warning | Amber | Warning callouts and badges only |

Surfaces use restrained borders and shadows. Pure black is avoided for body text. Typography and spacing remain consistent across all screens.

## 2. Application Shell

- Show TokTickIT identity in the header.
- Show My Tickets and Create Ticket navigation.
- Show the current Development Requester name.
- Provide Change Requester.
- Mark the active page using text and a non-color indicator.
- Collapse or adapt navigation for mobile widths.

## 3. Development Requester Selection

The screen contains a TokTickIT title, a short explanation that the selector is for Lab 2 testing only, an active-requester dropdown, and a Continue button. The screen must show loading, empty, API-failure, and required-selection states. Controls have labels, keyboard focus, and accessible names.

Suggested explanatory text:

> Select a Development Requester to test requester-specific behavior. This is not a login screen. Authentication will be introduced in Lab 3.

## 4. Create Ticket

System-generated or read-only fields appear visually distinct from editable controls. Group classification fields together, give Summary and Description sufficient width, place Attachments logically, and keep the primary action visible.

Required fields show a red asterisk plus a text validation message. Labels appear above controls. The submit button has visible text, a busy state, and is disabled while submitting. Success clearly displays the generated Ticket Number and a next action. Failure keeps entered values.

Required modes:

- Initial
- Reference-data loading
- Invalid field values
- Invalid attachment
- Submitting
- Success
- API failure

## 5. My Tickets

The desktop representation is a readable table or equivalent list with enough information to identify a Ticket. At minimum show Ticket Number, Summary, Category, Current Status, Requested Priority, and Last Updated. Provide Search, filters, sorting, Clear Filters, pagination, and Create Ticket.

The mobile representation may use cards or a responsive table but must preserve the same information and actions. Distinguish empty-list from no-results.

## 6. Ticket Detail

Ticket fields are read-only. Separate the ticket information from attachment actions. Show Ticket Number, date, requester, category, related system, summary, description, requested priority, current status, and timestamps. Do not add comments, internal notes, Actions Taken, or workflow status controls.

## 7. Attachment States

Show active, uploading, invalid, removed, and unavailable states. Display original filename, type, size, date, and removal reason where available. Removed files remain visible as metadata but show no download or preview action. Removal requires a confirmation message and a reason.

## 8. Responsive Rules

| Viewport | Behavior |
|---|---|
| Desktop, 992px and wider | Centered multi-column layout with sensible max width |
| Tablet, 768-991px | Two columns where practical; Summary and Description remain readable |
| Mobile, under 768px | Stack fields; touch-friendly buttons; no horizontal page scrolling |

All sizes must avoid clipped labels, overlapping validation, hidden buttons, unreadable attachment names, and unexpected overflow.

## 9. Accessibility Rules

- Every form control has a visible label and accessible name.
- Required fields use both an asterisk and a text message.
- Icon-only controls require an accessible label and tooltip.
- Keyboard focus indicators remain visible.
- Disabled controls cannot be activated and are visually distinct.
- Errors and success are communicated with text and not color alone.
- Table/card actions are keyboard reachable.
- Attachment state and removal status are understandable without color perception.

## 10. Visual Inspection Checklist

- [ ] Zen Green tokens are used consistently.
- [ ] Editable and read-only fields are distinguishable.
- [ ] Field labels, required markers, and validation placement are consistent.
- [ ] Button hierarchy and busy/disabled states are clear.
- [ ] Desktop table and mobile representation are usable.
- [ ] Priority and status badges are consistent.
- [ ] Empty and no-results states are different and useful.
- [ ] No clipping, overlap, or unintended horizontal scroll exists.
- [ ] Screenshots are saved under `artifacts/lab-02/screenshots/`.
