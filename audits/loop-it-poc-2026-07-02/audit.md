# Loop It POC Product Design Audit

Date: 2026-07-02
Surface: http://localhost:3000/experiments/loop-it-poc
Mode: Combined UX and accessibility audit
Destination: local folder

## Captured Evidence

1. `01-overview.png` - full page overview.
2. `02-step-2-default.png` - Step 2 default recommendation.
3. `03-loop-type-picker-docs.png` - direct loop type picker set to Documentation sweep.
4. `04-text-recommendation.png` - typed task recommendation for skill-library work.
5. `05-run-prompt.png` - Step 3 generated prompt after using the recommendation.
6. `06-mobile.png` - mobile full-page reflow.

## Audit Scope

This audit covers the first-time user flow for Loop It:

1. Install the plugin.
2. Select or describe the loop.
3. Generate and copy the run prompt.

The specific product question is whether users can understand what a loop is, access the loop library without using a chatbar, and know that the generated prompt is what makes the agent do the work.

## User Goal And Accessibility Target

The user should be able to install Loop It, choose the right loop type, and copy a clear agent prompt without needing to understand the internal library structure.

The page should support keyboard users, screen reader users, and mobile users well enough for this flow: labeled controls, visible state changes, clear reading order, no hidden critical actions, and no horizontal content traps.

## Step Notes

### Step 1: Full Page Overview

Evidence: `01-overview.png`

Health: good foundation, still slightly dense.

Strengths:
- The hero now states the actual flow clearly: install, describe, run.
- The three-step strip creates a simple mental model before the detailed sections.
- Step 3 explicitly says the loop file alone is only the contract, which helps prevent the earlier misunderstanding that `.loop-it/LOOP.md` fixes the issue by itself.

Risks:
- The page still exposes a lot at once. New users can see install, recommendation, agent tabs, command, editable fields, checklist, and prompt in one long page.
- The term "loop" is still not defined in plain language near the first decision point.

Recommendation:
- Add one short definition near Step 2: "A loop is the work pattern the agent will follow, including the goal, proof, and stop rule."

### Step 2: Default Recommendation

Evidence: `02-step-2-default.png`

Health: usable, but the state model is too busy.

Strengths:
- Users now have a direct non-chatbar path through the `Pick a loop type` dropdown.
- The recommendation card explains "Best for" and "Proof it needs," which is the right information for trust.
- `Continue to Step 3` gives a clear next action.

Risks:
- Step 2 has three competing inputs: task search, common-work buttons, and loop type picker. They are useful, but the page does not explain whether they are alternatives or should be used together.
- `Pick a loop type` does not say "library," so users asking for the loop library may not recognize this as the library access point.
- The default already says `Using recommendation`, but the user has not made a choice yet. That can feel like an automatic decision happened without them.

Recommendation:
- Rename the dropdown label to `Choose from loop library`.
- Make the default state passive: show `Recommended` or `Ready`, not a disabled-looking action button.
- Treat the three controls as one choice model: "Choose from library, or describe the work and let Loop It recommend one."

### Step 2: Direct Loop Library Picker

Evidence: `03-loop-type-picker-docs.png`

Health: strong direction, naming needs work.

Strengths:
- This proves there is a direct way to access the loop library without chatbar input.
- Selecting a loop updates the recommendation card immediately.
- Category text inside the option, such as `Content`, helps users understand what kind of work the loop is for.

Risks:
- The picker is visually small compared with the search input, so users may still assume the main path is typing.
- The selected option is shown only in the dropdown and card. There is no short explanation that this is the internal library being used to generate the prompt.

Recommendation:
- Make the picker label explicit: `Loop library`.
- Add helper text under it: "Pick a loop directly, or type a task and Loop It will choose for you."

### Step 2: Typed Task Recommendation

Evidence: `04-text-recommendation.png`

Health: confusing state mismatch.

Strengths:
- Typing a realistic task changes the recommendation to `Skill instruction hardening`, which is good behavior.
- The input focus ring is visible.
- The clear button appears when text exists.

Risks:
- The dropdown still shows `Documentation sweep - Content` while the recommendation card shows `Skill instruction hardening`. This is the biggest UX issue in the captured flow.
- The mismatch makes it unclear which loop will be used in Step 3.
- The user can reasonably ask, "Did I select Documentation sweep or Skill instruction hardening?"

Recommendation:
- Keep one canonical selected loop. When the typed recommendation changes, update the dropdown to match it, or visually separate the dropdown as a manual override.
- If the dropdown is an override, label it clearly: `Override recommendation`.
- Until this is fixed, Step 2 will keep feeling unreliable even if the generated prompt is technically correct.

### Step 3: Generated Run Prompt

Evidence: `05-run-prompt.png`

Health: functional, but too much is competing for attention.

Strengths:
- The agent tabs make the install target concrete: Codex, Claude Code, Cursor.
- The prompt explicitly tells the agent not to stop after creating `.loop-it` files.
- The checklist asks for changed files, check output, result, and remaining risk, which matches the product promise.

Risks:
- The optional `.loop-it` command appears before the actual task fields and prompt. Because it is near the top, users may think it is required before copying the prompt.
- Long command and check text are clipped horizontally in the screenshot. That suggests overflow or hidden text risk for real users.
- The `Copy run prompt` button is clear, but the prompt body is visually heavy and may draw attention away from the exact next action.

Recommendation:
- Move `Optional: prepare loop files first` below the generated prompt or collapse it behind a secondary disclosure.
- Ensure long command and check fields can wrap, scroll intentionally, or show the full content on focus.
- Keep `Copy run prompt` as the primary action.

### Mobile Flow

Evidence: `06-mobile.png`

Health: readable, but long and text-heavy.

Strengths:
- The page reflows into a single column without obvious layout breakage.
- Buttons, picker, and prompt remain visible.
- The sequence remains Install, Describe, Run.

Risks:
- The mobile page is very long before the user gets to the copy action.
- The prompt block is dense on mobile and may feel like raw implementation detail before the user understands the result.
- The install command and generated command appear truncated in narrow width.

Recommendation:
- On mobile, make each step collapsible after completion.
- Keep Step 3 focused on the prompt and copy action; move optional setup details lower.

## Strengths

- The new three-step structure is much clearer than a library-first page.
- Direct loop selection now exists.
- The page communicates that the prompt is what tells the agent to fix, verify, and report.
- The recommendation card has the right trust ingredients: when to use the loop and what proof is needed.

## UX Risks

- Step 2 currently mixes recommendation, manual selection, and quick examples without a single state model.
- The direct library access is present but not named as the loop library.
- The dropdown and text recommendation can disagree.
- Step 3 puts optional file-generation command content before the primary copy-prompt action.
- Long command text can be clipped.

## Accessibility Risks

- The main controls have visible labels, but the state relationship between search, quick buttons, dropdown, and recommendation may be unclear to assistive technology users.
- Quick buttons should expose selected state with `aria-pressed` or a comparable pattern if they set the current recommendation.
- A disabled-looking `Using recommendation` button may be announced as an unavailable control rather than a completed status.
- Screenshot review cannot prove keyboard order, focus trapping, screen reader output, color contrast ratios, or clipboard behavior.

## Opportunity Areas

1. Make Step 2 a clear choose-one decision: library picker or task description.
2. Rename the picker so users understand it is the loop library.
3. Keep dropdown state and recommendation state synchronized.
4. Reduce Step 3 to one dominant action: copy the run prompt.
5. Treat `.loop-it` file generation as optional advanced setup, not the main path.

## Evidence Limits And Verification Gaps

- Screenshots were captured with Playwright against the local page.
- This audit did not test a real screen reader.
- This audit did not test full keyboard navigation.
- This audit did not inspect computed contrast ratios.
- This audit did not verify clipboard success after clicking `Copy run prompt`.
- This audit did not test every loop option in the library.

## Recommended Next Changes

1. Fix Step 2 state mismatch so the picker and recommendation cannot disagree.
2. Rename `Pick a loop type` to `Choose from loop library`.
3. Add one plain-language definition of a loop near Step 2.
4. Replace `Using recommendation` with passive selected status.
5. Move or collapse the optional `.loop-it` setup command in Step 3.
6. Add selected state semantics to quick buttons.
