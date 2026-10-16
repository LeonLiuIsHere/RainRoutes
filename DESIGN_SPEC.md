# Hortons Course Planner — Design Specification (Draft)

**Milestone:** CPEN 221A — Design Your Solution  
**Team:** Hortons  
**PM:** Tim  
**Design Lead:** Yuki  
**Developer Lead:** Stark  
**Status:** Draft for team review; problem evidence still needs student interviews.

## 1. Problem

UBC Computer Engineering students plan courses across multiple terms. To decide what to take next, a student may need to consider courses already completed, prerequisites, which courses are offered in a given term, section times, and personal schedule preferences. This information can require manual comparison across multiple sources. Students may have difficulty seeing eligible next courses and constructing a timetable that fits together.

The intended users are UBC Computer Engineering students who are planning a future term. The specific frequency, impact, and most frustrating parts of this problem are not yet established by Hortons user research. The team will validate these points through short interviews before treating them as confirmed.

### Questions for validation

- Tell us about the last time you planned your courses for a term. What did you do first?
- Which websites, documents, or people did you use? What did you need to check in each?
- What part took the most time or caused uncertainty? Can you give a specific example?
- How did you check whether you had met prerequisites and degree requirements?
- Did schedule conflicts or unavailable sections change your plan?
- What would make a course-planning tool useful enough for you to use? What would you still verify elsewhere?

The team should record anonymized notes, date, participant context (for example, year of study), and recurring themes. Do not record student numbers or sensitive personal information.

## 2. Solution overview

Hortons Course Planner helps a student explore a draft term plan. It accepts completed/in-progress courses, a target term, and optional preferences. It returns candidate courses, explains prerequisite eligibility, displays sections, and helps assemble a non-conflicting timetable.

The product is a planning aid. It does not make official degree-audit or registration decisions. Every displayed course and section should identify the term and data source. The student should be directed to confirm official requirements and registration details before acting.

### Design rationale

The main value is reducing the manual work of connecting prerequisites to term offerings and schedules. The design keeps eligibility rules visible so students can understand why a course appears. Preferences are treated as adjustable preferences, while prerequisite eligibility and time conflicts are treated as hard constraints. This helps avoid presenting a preferred but ineligible or conflicting schedule as valid.

## 3. Primary user and task

**Primary user:** A UBC Computer Engineering student planning a future academic term.

**Primary task:** Find eligible course options and assemble a draft schedule that satisfies prerequisites and has no time conflicts, while honoring as many personal preferences as possible.

### Main flow

1. Start a plan and select the target term.
2. Enter courses completed and courses currently in progress.
3. Add optional preferences, such as avoiding classes before 9 a.m., finishing early on Friday, or preferring nearby buildings between consecutive classes.
4. Review eligible courses, each with a prerequisite explanation and source/term label.
5. Select courses and review their available sections.
6. Compare valid section combinations in a weekly timetable.
7. Adjust selections/preferences or save/export the draft plan.

## 4. Screens and behavior

### Screen A — Start a plan

**Content:** Product title; short explanation; target-term selector; “Start planning” action; brief note that results are planning guidance and official details must be verified.

**Behavior:** The target term is required. If no term is selected, the action remains disabled and a nearby instruction explains what is missing. Selecting an available term starts a new plan.

### Screen B — Courses and preferences

**Content:** Searchable course list; selected completed courses; separate selected in-progress courses; preference controls for earliest class time, preferred Friday finish, and optional campus/building-transition comfort. Actions: “Show eligible courses” and “Back”.

**Behavior:** A course cannot be in both completed and in-progress lists. Duplicate selections are ignored with a clear message. Preferences are optional. If the student selects no course history, explain that prerequisite-based recommendations will be limited; allow continuing if they choose.

### Screen C — Eligible course options

**Content:** Course cards show course code/title, prerequisite status, a plain-language explanation of satisfied or missing prerequisites, term availability, and official data source/last-checked label. Filters include eligible courses and all courses with unmet prerequisites. Action: “Choose sections”.

**Behavior:** Only courses whose prerequisites are satisfied by completed courses and by the team's documented treatment of in-progress courses are marked eligible. In-progress prerequisites must be labeled as conditional, never silently treated as completed. Courses with missing prerequisite data are marked “eligibility unknown” and excluded from confirmed-eligible results. If no courses qualify, explain why and offer to edit course history or inspect courses with unmet prerequisites.

### Screen D — Section and timetable comparison

**Content:** Selected courses and their sections; a weekly timetable; schedule conflicts highlighted; list of alternative valid combinations; each section includes day/time, location if available, instructor if available, and source/term label. Actions: remove a course, change a section, compare another plan, return to options.

**Behavior:** A combination with overlapping meeting times is never labeled conflict-free. If building locations are available, consecutive classes in distant buildings may be flagged as a travel concern; building distance is a preference warning, not a prerequisite rule. When no section combination matches preferences, show the closest valid schedules and say which preference was relaxed. Do not silently relax prerequisites or time-conflict rules.

### Screen E — Plan summary

**Content:** Draft timetable, selected courses and sections, unmet/conditional items if any, applied preferences, and data-source/term note. Actions: edit plan; print or export a draft (if implemented).

**Behavior:** The summary distinguishes confirmed eligibility from conditional or unknown data. It reminds users to confirm official degree requirements, course offering, section availability, and registration eligibility with UBC before registration.

## 5. Core rules

1. Prerequisite rules are evaluated using the team's documented course data for the selected term.
2. Completed and in-progress courses are represented separately.
3. An in-progress prerequisite may produce a conditional recommendation only if the course policy/data explicitly supports that interpretation; otherwise it remains unconfirmed.
4. Meeting-time overlap is a hard conflict.
5. User preferences rank or filter otherwise valid options; the interface states when a preference causes results to be omitted.
6. Missing, stale, or ambiguous course data is surfaced to the user and is not presented as verified.
7. Every course/section result identifies the data term and source.

## 6. Error and boundary states

- **No course history:** Explain that recommendations may be incomplete; allow user to add courses or continue with limited results.
- **No eligible courses:** Explain that no listed course meets the recorded prerequisites for the chosen term; provide edit and inspect-unmet-prerequisite actions.
- **No sections offered:** Show course eligibility separately from section availability; explain that no section data is available for the selected term.
- **No schedule satisfies preferences:** Show valid alternatives that relax soft preferences and identify the relaxed preference.
- **Time conflict:** Highlight both conflicting sections and prevent labeling the plan conflict-free.
- **Unknown prerequisite data:** Mark as unknown, show source status, exclude from confirmed recommendations.
- **Incomplete/inconsistent course selection:** Identify the duplicate or conflicting input and let the student correct it without losing other entries.
- **Data source unavailable or stale:** Show the last successful data date; do not imply the timetable is current.
- **Empty search result:** Explain that no match was found and offer to clear filters.

## 7. Data and scope

The MVP needs course descriptions, prerequisite relationships, term offerings, and section meeting times. Instructor names and locations may be included when available from a current official source. Before implementation, the developer lead will confirm source access, permitted use, update frequency, and term coverage. The initial data set should be small enough to validate manually.

Professor ratings are excluded from the first version because a dependable, explainable data source and coverage have not been established. Study-buddy matching, social groups, dining, laundry, and failed-course recovery are also outside the first version. These ideas can be reconsidered after validating the core planning need.

## 8. Success criteria for the design

A CPEN student who has entered course history can:

- identify why a course is shown as eligible, conditional, ineligible, or unknown;
- find sections for the selected term when data exists;
- identify timetable conflicts without manual comparison;
- see when preferences are not met and understand what trade-off produced an alternative;
- understand that the plan is a draft and where to confirm official information.

The team will assess these criteria with brief usability sessions after creating a clickable or working prototype.

## 9. Open decisions before implementation

- Which CPEN program year/requirements will the first curated data set cover?
- Which official UBC source will be used for prerequisites, offerings, and section schedules, and how often can it be refreshed?
- Will the first version generate one best-fit schedule or let users compare several valid schedules?
- Will plans be stored, or will the first version keep them only in the current session?
- What is the team's rule for courses currently in progress when evaluating prerequisites?

## 10. Provenance

This is a team draft based on the first-meeting notes and CPEN 221A project milestone guidance. User research findings and verified data-source details have not yet been added.
