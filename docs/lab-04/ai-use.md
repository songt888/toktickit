# Lab 4 AI Use and Reflection

## LLM used and current scope

OpenAI Codex (the VS Code session UI displayed GPT-6.1-Sol, high) assisted
with Lab 4 planning and the Issue #65 engineering contract. Claude Code
(Claude Sonnet 5.5) was added later, for example to read the Lab 4 handout and
to help review partner PR #81. This is specification work; no Lab 4 feature coding or teammate approval is claimed. The student
owns the design choices and must compare the contract with the handout,
review feedback and later implemented behavior.

## Selected real prompts (incomplete sprint record)

Only prompts visible in this conversation are recorded. Do not invent extra
prompts to fill the final 6-10 requirement. The full Lab 4 record must be
completed with actual later implementation/review prompts in Issue #73.

1. Lab 4 handout supplied as `SE+Lab+4.pdf` in the earlier VS Code conversation
   visible during this session. The initial accompanying instruction is not
   available here; no wording is reconstructed.
2. Actual planning acceptance visible in that conversation: "ok accept this plan".
   This authorized the Lab 4 workflow/Issue plan, not approval of the contract.
3. Actual Issue #65 instruction in this conversation (selected excerpts,
   originally written in Thai and translated to English here):
   "Write the documents in docs/lab-04/";
   "Define clearly: Action assignee/status, the append-only boundary, the Resolution gate, and Dashboard calculations";
   "Check consistency of the schema, API, UI, business rules, and AC/test mapping";
   "Commit/push and open a PR into lab4-staging";
   "Wait for a teammate to Approve and Merge".
   These are excerpts from one prompt, not five independent prompts.

Current count: two known text prompts plus one file input, not the final
6-10 selected prompt set. Playwright editor repair from this conversation
was separate work and is excluded from the contract commit and Lab 4 prompt count.

## Decisions checked against sources

The handout requires Action fields and editable Actions, while the rubric adds
assignment/status/complete/cancel, current-user Actions and append-only
behavior. The AI-assisted contract makes the unresolved choices explicit:
current Action projection with immutable revisions, separate performer and
assignee, exact resolution predicate, precise backend metrics and preserved
legacy data. These are proposed designs for peer review, not handout quotations
or prior approved decisions. API/UI/schema/AC/test names are checked together;
planned checks never become passing implementation evidence by inference.

## My Reflection

Student reflection is pending. The student should describe, in their own
words after review, what the specification-agent clarified, which generated
choices they accepted or rejected and why, and later how coding-agent output
was checked against actual tests/database/browser behavior. An AI-generated
first-person account would not be evidence of the student's experience.

At contract time the concrete risks identified are audit history being
overwritten during edits, assignment/actor confusion, Action-versus-resolution
races, legacy timestamps producing false recent metrics, runner patterns
silently omitting new tests, and fabricated approval/test/prompt records.
Later real decisions, corrections and executed verification belong here with
their actual PR/commit/test references. Final personal reflection and 6-10
real prompts remain explicit Product DoD requirements, not completed checkboxes.
