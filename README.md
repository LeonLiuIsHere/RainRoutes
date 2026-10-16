# Hortons Course Planner

**Team:** Hortons  
**Course:** CPEN 221A Team Project  
**Milestone 1:** Design Your Team + Design Your Solution  
**Team roles:** Tim — Project Manager (PM); Yuki — Design Lead; Stark — Developer Lead. All members contribute across roles.

## Mission

Help UBC Computer Engineering students plan their academic path with less effort and choose courses that fit their degree requirements and personal constraints.

## Problem statement (draft; validate with students)

UBC Computer Engineering students must plan courses across multiple terms while accounting for completed courses, prerequisite chains, course offerings, section schedules, and personal constraints. When this information is spread across program requirements, course descriptions, and schedule listings, students may need to compare it manually and can find it difficult to see which courses they are eligible to take and how available sections fit together. This can make course planning time-consuming and may lead to avoidable schedule conflicts or uncertainty about future prerequisites.

This is a working problem statement, not a claim that user research has confirmed the scale or frequency of the problem. Hortons will validate it through short interviews with CPEN students and by checking the information sources students currently use. The project will focus on helping students explore possible plans; students remain responsible for confirming official degree requirements and registration details.

## Proposed solution

Hortons Course Planner is an interactive planning tool. A student enters completed or in-progress courses and planning preferences. The tool shows candidate courses whose listed prerequisites are satisfied, available sections, and a draft timetable that respects hard constraints such as prerequisite eligibility and time conflicts. Students can adjust preferences and compare alternatives.

The first version will focus on one complete planning flow for CPEN students. Professor ratings, study-buddy matching, dining, laundry, and failed-course recovery are outside the first version unless later research and time permit.

## First-version scope

- Collect the student's completed and in-progress courses.
- Let the student choose a planning term and optional preferences (for example, avoid 8 a.m. classes or finish early on Friday).
- Show eligible course options with prerequisite explanations.
- Show sections and flag schedule conflicts.
- Build a draft weekly timetable and allow the student to compare options.
- Explain when no matching section is found and let the student relax preferences.

## Evidence and assumptions

No interview results have been recorded yet. Before treating the problem statement as validated, the team should interview CPEN students about a recent course-planning experience, ask what sources they used, and record concrete friction points. See [`INTERVIEW_GUIDE.md`](INTERVIEW_GUIDE.md).

Course, prerequisite, instructor, and section data must be checked against current official UBC sources before being shown as current. The team will document which source and term each dataset represents. Professor ratings are excluded from the first version because their source, coverage, and interpretation have not been established.

## Design specification

See [`DESIGN_SPEC.md`](DESIGN_SPEC.md) for the user flow, screens, rules, edge cases, and design rationale. The low-fidelity flow sketch is in [`mockups/core-flow.svg`](mockups/core-flow.svg).

## Next actions

| Owner | Action | Done when |
|---|---|---|
| Tim (PM) | Create the team GitHub repository; add team details and this problem statement to README | Repository is accessible to the course staff and the README has the final problem statement |
| Yuki (Design Lead) | Conduct and summarize brief CPEN student interviews; refine the problem and design spec | Notes include anonymized evidence and the spec reflects what was learned |
| Stark (Developer Lead) | Check feasibility of collecting course/prerequisite/section data and identify a small first-term dataset | Data source, term coverage, and limitations are documented |
| All members | Review this scope and the core flow together | Team agrees what the first version will and will not do |

## Status

This folder is a repository-ready draft package. Before submission, replace the provisional problem evidence with real interview findings and place the final Markdown files in the team's GitHub repository. Submit the public repository/specification link required by the course.
