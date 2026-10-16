# Hortons Course Planner

**Course:** CPEN 221A Team Project  
**Milestone 1:** Design Your Team + Design Your Solution  
**Team:** Hortons  
**Project Manager:** Tim  
**Design Lead:** Yuki  
**Developer Lead:** Stark

## Mission

Help UBC Computer Engineering students plan their academic path with less effort and choose courses that fit their degree requirements and personal constraints.

## Problem statement and evidence

UBC's published course-planning guidance asks students to check program requirements in the Academic Calendar and Academic Progress Report (APR), then build draft timetables in Workday. The guidance says Winter Term 1 and Term 2 require separate saved schedules and recommends keeping multiple schedule options because courses may fill. [UBC Student Services: How to register for courses](https://students.ubc.ca/enrolment/registration/register-courses/). UBC's Course Schedule also publishes course and standard-timetable information by academic period. [UBC Course Schedule](https://courses.students.ubc.ca/standard-timetables).

The planning task therefore involves connecting degree progress, prerequisites, term offerings, section times, and backup options. Existing tools already cover parts of this task: Workday supports saved schedules; [UBC Scheduler](https://ubcscheduler.ca/) generates schedules; and the public [UBCGradMap project](https://github.com/Meriadoc-Gradmap/UBCGradMap) visualizes UBC Vancouver course prerequisites and course information. Hortons is not claiming that UBC has no course-planning tools.

**Problem statement:** For UBC Computer Engineering students planning a future term, it can take several steps to connect their own completed coursework and CPEN prerequisite path with courses offered that term, specific section times, and personal schedule preferences. Existing tools provide useful planning features, but the team has not yet established whether CPEN students can easily use them together to identify eligible next courses and compare suitable backup schedules. Hortons will investigate this specific gap before claiming that it is common or burdensome.

### Evidence limits and validation

The points above are verified descriptions of UBC's published process and publicly available tools. They establish that planning information and actions span degree-progress, course, and schedule resources; they do **not** establish how often CPEN students experience difficulty or what impact it has. No Hortons student interviews have been completed yet. The team will validate the unmet-need hypothesis through brief interviews about students' recent planning experiences and by asking them to compare their current tools. Do not present the hypothesis as a confirmed user-research finding.

## Proposed solution

Hortons Course Planner is a CPEN-focused planning aid. A student selects a target term, enters completed and in-progress courses, and optionally sets schedule preferences. The tool shows candidate courses with a plain-language prerequisite explanation, available sections, and draft timetable alternatives. It labels time conflicts and explains when an option is conditional or cannot be verified from the available data.

The tool complements existing official planning and registration systems; it does not make official degree-audit or registration decisions. Students must confirm current requirements and availability in UBC systems before registering.

## First-version scope

- Collect the student's completed and in-progress courses.
- Let the student choose a planning term and set optional preferences, such as avoiding 8 a.m. starts or finishing early on Friday.
- Show candidate courses and explain prerequisite eligibility, conditional status, or unknown data.
- Show sections for the chosen term and flag overlapping meeting times.
- Build and compare draft weekly schedules that satisfy hard constraints.
- When no option satisfies all preferences, show valid alternatives and identify which soft preference each alternative relaxes.

Professor ratings, study-buddy matching, social groups, dining, laundry, and failed-course recovery are outside the first version. The team can reconsider them only after validating the core need and checking the available project time.

## Existing tools and the question Hortons will test

- **Workday:** UBC's official system supports saved schedules and registration.
- **UBC Scheduler:** A public schedule-generation tool for UBC courses.
- **UBCGradMap:** A public project that visualizes UBC Vancouver course prerequisites and related course details.

The team should test current versions of these tools with CPEN students before asserting what is missing. Hortons' proposed focus is one CPEN-oriented flow connecting a student's own course history, prerequisite explanations, current-term sections, schedule preferences, and alternative valid schedules. Whether that combination is useful and meaningfully different remains to be validated.

## Design specification and sketch

See [`DESIGN_SPEC.md`](DESIGN_SPEC.md) for the user flow, screen behavior, rules, edge cases, data limits, and research plan. See [`core-flow.svg`](core-flow.svg) for the low-fidelity three-screen flow sketch. The course names and schedule in the sketch are illustrative placeholders, not verified offerings.

## Team roles

- **Tim - Project Manager:** coordinates the team, milestones, communication, and resources.
- **Yuki - Design Lead:** leads problem understanding, user research, interaction design, sketches, and usability review.
- **Stark - Developer Lead:** checks technical and data feasibility, leads implementation planning, and supports verification and deployment.

## Next actions

| Owner | Action | Done when |
|---|---|---|
| Tim | Create/update the team GitHub repository and place the final README, design specification, and sketch in it | Course staff can access the repository and all links work |
| Yuki | Interview CPEN students about a recent course-planning experience and summarize anonymized themes | The problem statement reflects actual evidence and notes clearly separate findings from assumptions |
| Stark | Check official UBC sources and the feasibility of a small CPEN course/prerequisite/section dataset | Source, term coverage, update limitations, and verification approach are documented |
| All members | Review the proposed gap against existing tools and agree on MVP boundaries | Team agrees what the first version does and does not do |

## References

1. [UBC Student Services - How to register for courses](https://students.ubc.ca/enrolment/registration/register-courses/) (accessed October 16, 2026).
2. [UBC Course Schedule - Standard Timetables](https://courses.students.ubc.ca/standard-timetables) (accessed October 16, 2026).
3. [UBC Scheduler](https://ubcscheduler.ca/) (public tool, accessed October 16, 2026).
4. [UBCGradMap public repository](https://github.com/Meriadoc-Gradmap/UBCGradMap) (accessed October 16, 2026; a third-party project, not an official UBC service).
