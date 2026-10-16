# Hortons Course Planner - Design Specification

**Course:** CPEN 221A Team Project  
**Milestone:** Design Your Solution  
**Team:** Hortons  
**Project Manager:** Tim  
**Design Lead:** Yuki  
**Developer Lead:** Stark

## 1. Problem

UBC's published guidance directs students to check program requirements in the Academic Calendar and Academic Progress Report (APR), then build draft timetables in Workday. UBC says Winter Term 1 and Term 2 require separate saved schedules and recommends preparing multiple schedules because courses may fill. The Course Schedule publishes courses and standard timetables by academic period. See [UBC's registration guidance](https://students.ubc.ca/enrolment/registration/register-courses/) and [UBC Course Schedule](https://courses.students.ubc.ca/standard-timetables).

This creates a planning task that connects a student's degree progress and completed courses with prerequisites, term offerings, section times, and backup schedules. Existing tools already support parts of this task: Workday supports saved schedules, [UBC Scheduler](https://ubcscheduler.ca/) generates course schedules, and [UBCGradMap](https://github.com/Meriadoc-Gradmap/UBCGradMap) visualizes UBC Vancouver course prerequisites and course information.

**Focused problem statement:** For UBC Computer Engineering students planning a future term, it can take several steps to connect their own completed coursework and CPEN prerequisite path with courses offered that term, specific section times, and personal schedule preferences. Existing tools provide useful planning features, but the team has not yet established whether CPEN students can easily use them together to identify eligible next courses and compare suitable backup schedules. Hortons will investigate this specific gap before claiming that it is common or burdensome.

### Evidence and limits

UBC's published pages support the description of the official planning process and the separate planning tasks. The public UBCGradMap repository documents an existing third-party prerequisite-visualization project. These sources do not prove that CPEN students experience the task as difficult, nor do they establish the frequency or impact of any difficulty. Hortons has not yet conducted student interviews. Therefore the unmet-need claim is a hypothesis, not a confirmed finding.

### Research plan

Conduct brief interviews with CPEN students about a recent course-planning experience. Ask them to describe their steps and tools before showing the Hortons concept. Record anonymized notes and distinguish observed findings from interpretation. Compare the proposed flow with Workday, UBC Scheduler, and UBCGradMap so the team does not assume a feature gap that may not exist.

Suggested questions:

- Tell us about the last time you planned courses for a term. What did you do first?
- Which websites, documents, or people did you use, and what did you check in each?
- What part took the most time or caused uncertainty? Can you give a specific example?
- How did you check prerequisites and degree requirements?
- Did schedule conflicts or unavailable sections change your plan? What did you do?
- What would you still verify in official UBC systems even if you used a planner?
- After seeing the concept, what seems useful, confusing, or already covered by your current tools?

Do not record student numbers or sensitive personal information. A few interviews can provide examples and reveal themes, but should not be described as representative of all CPEN students.

## 2. Solution overview

Hortons Course Planner is a CPEN-oriented planning aid for exploring a draft term plan. It accepts completed and in-progress courses, a target term, and optional schedule preferences. It presents candidate courses with prerequisite explanations, available sections, and draft timetable alternatives. It identifies time conflicts and labels conditional or unknown data.

The tool complements Workday and other existing resources. It does not replace UBC's official degree audit, advising, course schedule, or registration systems. Each course and section must show its data term and source. Students must confirm official requirements and availability before registration.

### Design rationale

The proposed value is connecting a student's recorded course history and prerequisite path with term-specific sections and personal scheduling preferences, then comparing valid alternatives. This is a hypothesis about a potential gap, not a claim that existing tools cannot plan schedules. Research will determine whether this combined CPEN-focused flow is useful.

Prerequisite eligibility and meeting-time conflicts are hard constraints. Personal preferences (such as avoiding 8 a.m. starts, finishing early on Friday, or reducing travel between consecutive classes) are soft constraints. If no schedule meets every preference, the interface must show valid alternatives and identify each relaxed preference; it must never silently relax prerequisites or time-conflict rules.

## 3. Primary user and task

**Primary user:** A UBC Computer Engineering student planning courses for a future term.

**Primary task:** Explore courses whose prerequisites appear satisfied and compare valid section schedules that have no time conflicts and match as many personal preferences as possible.

### Main flow

1. Start a plan and select the target term.
2. Enter courses completed and courses currently in progress.
3. Add optional preferences, such as avoiding 8 a.m. starts, finishing early on Friday, or preferring shorter travel between consecutive classes.
4. Review candidate courses with a prerequisite explanation and source/term label.
5. Select courses and review their sections for the chosen term.
6. Compare valid section combinations in a weekly timetable.
7. Adjust selections or preferences and save/export a draft plan if that feature is implemented.

The sketch is in [`core-flow.svg`](core-flow.svg). All course codes, term details, and timetable blocks shown there are illustrative placeholders, not verified current offerings.

## 4. Screens and behavior

### Screen A - Start a plan

**Content:** Product title; short explanation; target-term selector; “Start planning” action; note that results are planning guidance and official details must be verified.

**Behavior:** The target term is required. If no term is selected, the action remains disabled and an instruction explains what is missing. Selecting an available term starts a new plan.

### Screen B - Courses and preferences

**Content:** Searchable course list; selected completed courses; separate selected in-progress courses; optional preference controls for earliest class start, preferred Friday finish, and travel between campus buildings. Actions: “Show eligible courses” and “Back”.

**Behavior:** A course cannot appear in both completed and in-progress lists. Duplicate selections are ignored with a clear message. Preferences are optional. If no course history is provided, explain that prerequisite-based recommendations will be limited and allow the student to continue if they choose.

### Screen C - Candidate course options

**Content:** Course cards show course code/title, prerequisite status, a plain-language explanation of satisfied or missing prerequisites, term availability, and official data source/last-checked label. Filters include courses that appear eligible and courses with unmet prerequisites. Action: “Choose sections”.

**Behavior:** Only courses whose prerequisites are satisfied by completed courses and by the team's documented treatment of in-progress courses are marked eligible. In-progress prerequisites must be labeled conditional, never silently treated as completed. Courses with missing prerequisite data are marked “eligibility unknown” and excluded from confirmed-eligible results. If no courses qualify, explain why and offer to edit course history or inspect unmet prerequisites.

### Screen D - Section and timetable comparison

**Content:** Selected courses and their sections; a weekly timetable; highlighted time conflicts; alternative valid combinations. Each section includes day/time, location if available, instructor if available, and source/term label. Actions: remove a course, change a section, compare another plan, and return to course options.

**Behavior:** A combination with overlapping meeting times is never labeled conflict-free. If building locations are available, distant consecutive classes may be flagged as a travel concern; building distance is a preference warning, not a prerequisite rule. When no schedule satisfies all preferences, show the closest valid schedules and name each relaxed preference. Never silently relax prerequisites or time-conflict rules.

### Screen E - Plan summary

**Content:** Draft timetable; selected courses and sections; unmet/conditional items, if any; applied preferences; and data-source/term note. Actions: edit plan; print or export a draft if implemented.

**Behavior:** Distinguish confirmed eligibility from conditional or unknown data. Remind students to confirm official degree requirements, course offerings, section availability, and registration eligibility with UBC before registering.

## 5. Core rules

1. Evaluate prerequisite rules using the team's documented course data for the selected term.
2. Represent completed and in-progress courses separately.
3. An in-progress prerequisite may produce a conditional recommendation only when the applicable course policy/data supports that interpretation; otherwise eligibility remains unconfirmed.
4. Treat overlapping meeting times as a hard conflict.
5. Use preferences to rank or filter otherwise valid options; state when a preference causes options to be omitted.
6. Surface missing, stale, or ambiguous course data; do not present it as verified.
7. Identify the data term and source for every course/section result.
8. Do not store student identifiers or grades in the first version. Course-history input should be limited to what is needed for planning.

## 6. Error and boundary states

- **No course history:** Explain that recommendations may be incomplete; allow the student to add courses or continue with limited results.
- **No candidate courses:** Explain that no listed course meets the recorded prerequisites for the chosen term; provide actions to edit course history or inspect unmet prerequisites.
- **No sections offered:** Show course eligibility separately from section availability; explain when no section data is available for the selected term.
- **No schedule satisfies preferences:** Show valid alternatives that relax soft preferences and identify the relaxed preference.
- **Time conflict:** Highlight both conflicting sections and do not label the plan conflict-free.
- **Unknown prerequisite data:** Mark as unknown, show source status, and exclude it from confirmed recommendations.
- **Incomplete/inconsistent course selection:** Identify duplicate or conflicting input and let the student correct it without losing other entries.
- **Data source unavailable or stale:** Show the last successful data date and do not imply the timetable is current.
- **Empty search result:** Explain that no match was found and offer to clear filters.

## 7. Data and scope

The MVP needs course descriptions, prerequisite relationships, term offerings, and section meeting times. Instructor names and locations may be included only when available from a current, appropriate source. Before implementation, the developer lead will confirm source access, permitted use, update frequency, and term coverage. The initial dataset should be small enough to verify manually.

Do not scrape or reproduce data until the team has checked source terms and technical access. Use official UBC sources as the authority for requirements and registration. Third-party tools are useful comparison points, not authoritative sources.

Professor ratings are excluded from the first version because a dependable, explainable source and its coverage have not been established. Study-buddy matching, social groups, dining, laundry, and failed-course recovery are also outside the first version.

## 8. Success criteria for the design

In a short usability session, a CPEN student who has entered course history can:

- identify why a course is shown as eligible, conditional, ineligible, or unknown;
- find sections for the selected term when data exists;
- identify timetable conflicts without manual comparison;
- see when preferences are not met and understand the trade-off behind an alternative;
- understand that the plan is a draft and where to confirm official information;
- explain whether the Hortons flow adds value beyond the tools they currently use.

## 9. Open decisions before implementation

- Which CPEN program year/requirements should the first curated dataset cover?
- Which official UBC source will be used for prerequisites, offerings, and section schedules, and how can it be refreshed?
- What does the first version add beyond Workday, UBC Scheduler, and UBCGradMap?
- Will it generate one best-fit schedule or let students compare several valid schedules?
- Will plans be stored, or will the first version keep them only in the current session?
- How should courses currently in progress count when evaluating prerequisites?

## 10. References

1. [UBC Student Services - How to register for courses](https://students.ubc.ca/enrolment/registration/register-courses/) (accessed October 16, 2026).
2. [UBC Course Schedule - Standard Timetables](https://courses.students.ubc.ca/standard-timetables) (accessed October 16, 2026).
3. [UBC Course Schedule - Course Search](https://courses.students.ubc.ca/course-search) (accessed October 16, 2026).
4. [UBC Scheduler](https://ubcscheduler.ca/) (public tool, accessed October 16, 2026).
5. [UBCGradMap public repository](https://github.com/Meriadoc-Gradmap/UBCGradMap) (third-party project, accessed October 16, 2026).
