# Hortons Rain Routes — Design Specification

**CPEN 221A · Milestone 1 · Version 3.2**  
**Team:** Hortons — Tim, Yuki, Stark, Leon, Ryan  
**PM:** Tim · **Design Lead:** Yuki · **Development Lead:** Stark  
**Research reference date:** October 16, 2026, Vancouver.

Read with the [README](README.md) and [interface storyboard](core-flow.svg). The behaviours below are proposed requirements. The storyboard illustrates the interaction; this milestone submission does not contain implemented route-query software.

Additional route-results and no-available-route sketches will be supplied by team members before submission. They are pending and are not claimed to be present in the current storyboard. Any illustrative route or numerical value will be identified as an example, not a verified field result.

**Confirmed scope:** User-entered origins, destinations, and times drive route planning and map display. Users manually inspect routes and photographs. There is no GPS reading, live position tracking, automatic instruction advancement, turn notification, deviation detection, or location-permission request. Computation starts at the location the user selects.

## 1. Problem, users, and value hypotheses

The target user is a UBC student who has a destination but is unfamiliar with nearby entrances and through-building access. The task may involve several buildings or simply crossing one building from one side to another.

The application organizes building and entrance information on a map and computes lower-exposure paths on a verified network. Two hypotheses require separate evaluation:

- **Information value:** Students can identify doors, availability, and internal passages without repeated entry attempts or scattered searches.
- **Route value:** A feasible alternative reduces exposed walking within an acceptable detour, without errors about floors, permissions, or instructions causing backtracking.

The README documents evidence and existing tools. Evaluation must compare the proposal with the official map, familiar walking routes, and existing workarounds. The absence of a feature named “rain route” is not sufficient evidence of value.

## 2. Pilot areas and published coverage

| ID | Candidate buildings / landmarks | Official reference query | Information required before publishing routes |
|---|---|---|---|
| A | ESB, KAIS, CEME, MCLD, ICCS, BRIM | BRIM → ESB 365 m; ICCS → ESB 308 m | Door coordinates, actual bridge floors and availability, exposed links to ESB |
| B | CHEM B/C/D/E, CHPH, HEBB, HENN, IKB | Chemistry B → IKB 354 m | Public passage conditions, floor changes, exposed links between Chemistry and IKB |
| C | Bus Exchange, LIFE, Nest, Aquatic, SRC / Rec North, IKB | Bus Exchange → IKB 458 m | Relevant doors, building and door schedules, and whether a useful sheltered detour exists |

The list includes contextual landmarks; it does not imply that every building will participate in routing. Each map publishes its supported buildings, doors, passages, and version. The selected corridor endpoints have been queried on the official map, but no exhaustive entrance-pair calculation has established the farthest pair.

**Coverage target:** Make three pilot areas browsable. Initially investigate 2–3 key passage buildings or destinations per area and prioritize 2–4 relevant doors per building. Establish one complete, independently reviewable end-to-end route before expanding. Investigate A first; prioritize the others using the evidence collected.

## 3. Map presentation

### 3.1 Backgrounds

- Use official UBC overhead backgrounds. A/B use Default; C includes Imagery. Default supports label reading, while Imagery helps users recognize buildings and roofs. A later implementation may offer a background switch.
- Record `map_id/version/source_url/captured_at/image_epoch/width/height` for each fixed image extent. Keep capture date separate from imagery date.
- Retain the source map's entrance symbols. Added interactive markers have a separate legend so service or accessibility icons are not mistaken for doors.
- Keep annotations in an independent overlay. Do not obscure the background or describe hand-drawn survey relationships as official recommended routes.
- Dashed survey relationships are not walking geometry or a distance-measurement source. Published routes require polylines following actual turns and passages.

### 3.2 Layers

1. **Buildings:** Name, abbreviation, and selectable outline. Unsupported buildings can remain background landmarks.
2. **Entrances:** Separate IDs for supported doors. Distinguish verified, unknown, and closed-under-recorded-rules states through text or shape as well as colour.
3. **Connections:** Separate styles for indoor, covered outdoor, and exposed segments; label floor changes.
4. **Routes:** Origin/destination, selected and alternative paths, and ordered entry/exit points.
5. **Survey status:** Show unverified relationships only in the research/design view. Do not treat them as usable paths in published recommendations.

Images, hit areas, markers, and polylines share a coordinate transform when zoomed or panned. Provide a complete building/entrance list on narrow screens so precise marker selection is not required.

## 4. Pages and user flows

### 4.1 Home: plan a route or browse directly

Provide two clear starting actions. The route form contains:

| Input | Rule |
|---|---|
| Region | A/B/C. Clear previously selected doors that are outside the newly selected region. |
| Origin and destination | Select supported places. A building can be selected first, followed by a specific entrance. A building centre must not imply passage through walls. |
| Departure | Date and time in `America/Vancouver`, including daylight-saving handling. Default to the current local time. |
| Maximum additional walking time | Offer 0, 2, or 5 minutes, or a non-negative custom value. Use it as a route constraint. |
| Access category | Default to an ordinary visitor. Use recorded permission categories only; do not request a student number or uploaded access card. |

Provide inline messages for missing locations, identical endpoints, invalid times, and unsupported coverage. **Browse access map** bypasses the route form.

### 4.2 Browse the access map without a complete trip

Show region switching, building search, layer controls, a legend, and verification dates. Selecting another door does not reset the map. Preserve map extent and the selected time when returning to the list.

**Select a building:** Display its full name, purpose, supported doors, published building hours, indoor-map link, and actions to inspect passages or select route endpoints.

**Select an entrance:** Display:

| Field | Content and behaviour |
|---|---|
| Door identity | Building, door ID, side/orientation, entrance photograph, and floor |
| Opening/closing schedule | This door's weekly rules and date exceptions; explicitly show Unknown when absent |
| Computed status | Expected available, closed, permission required, or unknown under recorded rules at the selected time; never a live lock status |
| Permissions | Public, specified access category, exit-only, or unknown; record entry and exit separately |
| Passage | Reachable exits, floors, stairs/elevator/bridge, and a link to step descriptions |
| Evidence | Rule source, sign photographs, observation and review dates, and update status |
| Actions | Set origin/destination, inspect a single-building passage, or report an issue |

**LIFE example:** The building card may quote published building hours. The door card must separately state that this particular door's schedule and card conditions remain unverified. A weekday 10:00 selection is not enough to label the door confirmed open.

**MCLD example:** The MCLD 3008 classroom's keycard rule may be cited as a room-specific record. It must not be applied to the main entrance, other rooms, or bridges.

### 4.3 Cross one building

Within a building card, choose an entrance and then a supported exit. List the entry floor, turns, necessary vertical movement, and exit location; highlight the relevant doors. If the continuous passage has not been verified, show **Passage information incomplete** rather than drawing a straight line between doors as an instruction.

Users may inspect exits and photographs without submitting a complete route query or specifying a destination in another area.

### 4.4 Compare routes

Return no more than two main options:

- **Baseline:** The feasible path with the shortest estimated time within the same verified dataset and departure conditions.
- **Lower exposure:** The feasible path with the least exposed distance within baseline time plus the user's detour allowance. Break ties by total time, then number of floor changes.

Each card shows total distance, estimated walking time, exposed distance, additional time, exposed-distance reduction, key doors, and floors. Do not fill unmeasured fields with invented numbers. The official 365/354/458 m research references are neither our algorithm's outputs nor measurements of exposed distance.

Valid outcomes include two different paths, one path when both options coincide, or a baseline without a verified alternative. Retain map browsing in every case. Deliberately adding an unnecessary detour does not establish a useful innovation.

### 4.5 Route details

The map and segment cards describe: approach Door A → enter → follow the verified path on the specified floor → take a bridge/stair/elevator → leave through Door B → continue to the next segment. Include recognizable landmarks and photographs where useful.

Users select steps and view photographs manually. The application does not determine which step they have reached. Users may manually exclude a closed segment and query again, without GPS-based rerouting. Reports enter a review queue rather than immediately changing shared data. State clearly when no alternative is available.

## 5. Access states and evidence

Availability is not a single Boolean value. Distinguish published rules, a one-time observation, permissions, and live state.

| State | Conditions | Routing treatment |
|---|---|---|
| Eligible for recommendation | Passage verified, schedule covers the selected time, permissions match, no applicable closure | Include and describe as expected available under recorded rules |
| Additional permission required | A documented permission requirement is not matched by the user's category | Exclude; keep its explanation visible in the map |
| Closed | Time outside the applicable schedule or an active closure | Exclude |
| Unknown / verification pending | Unclear hours, entry permission, direction, or continuous passage | Exclude restricted indoor segments; retain an unknown-state information card |
| Outdated record | Review period expired or conflicting evidence unresolved | Flag for review; stop recommending critical affected segments |

An unlocked door observed once is stored as `observed_open_at`, not a weekly schedule. Building hours belong to the building record. A door rule needs its own source or verification note.

Date-specific exceptions override weekly hours. Check later doors and connections at the estimated time of arrival, not just at departure. The first version does not plan waits for doors to open. Treat candidates that conflict with closing times as infeasible and explain the data boundary.

## 6. Data model

### 6.1 Maps and buildings

```text
Map: id, version, source_url, captured_at, imagery_date,
     image_width, image_height, attribution, supported_bounds
Building: id, names, map_id, polygon[], official_hours,
          hours_source, hours_valid_dates, indoor_map_url
```

The concept uses pixel/normalized image coordinates for fixed backgrounds, not geographic positioning. If a later version uses geographic layers, maintain the geographic coordinates and projection relationship separately. Screen pixels are not metres.

### 6.2 Entrances

```text
Door: id, building_id, map_id, x_norm, y_norm, floor,
      side_label, photos[], enter_rule, exit_rule,
      weekly_windows, exceptions[], permission_tags[],
      source_ids[], observed_at, verified_at, reviewer,
      verification_status, valid_until
```

Store coordinates as `x / original_width` and `y / original_height`. Changing the map extent requires a new map version and realignment. Door points manually transcribed from official symbols are map-based positions, not GPS measurements.

### 6.3 Route network

```text
Node: id, type(door/junction/stair/lift/bridge), building_id,
      floor, map_id, x_norm, y_norm
Edge: id, from, to, geometry[], distance_m, walk_seconds,
      exposed_m, cover_type(indoor/covered/outdoor/unknown),
      permission_tags[], weekly_windows, exceptions[],
      source_ids[], verification_status, valid_until,
      instruction, photo_ids[]
Source: id, title, url_or_photo, published_at, checked_at,
        scope(building/door/room/edge), supported_claim
```

Represent a two-way passage with two directed edges, allowing different entry/exit rules. Use field measurements or reliable map measurements for distance; record stair/elevator time separately. Assign zero exposed metres only to confirmed fully indoor segments. Keep covered outdoor segments distinct, since a roof does not guarantee complete protection from wind-driven rain.

## 7. Architecture and computation

### 7.1 Initial architecture

The application will follow the client-server pattern required by the [course project overview](https://ubc-ece.craft.me/cpen221/fall2026/project/b/133A5A11-7F19-4C3D-BFFA-94C087E14D81/Overview). The final deployment will exchange requests and responses between a browser client and a server on different machines. Running both on one computer is acceptable for development, but the server is a planned part of the MVP rather than an optional later addition.

**Browser client:** Collect the supported origin, destination, departure date/time, detour allowance, and permission category; send requests over HTTP; render the regional map, entrance information, returned route geometry, and passage steps. The browser will not obtain a GPS position or track the user.

**Server:** Load the team's reviewed, versioned JSON files; provide building and entrance records for browsing; validate route inputs; evaluate permissions, schedules, exceptions, and record validity at estimated arrival times; compute routes using Section 7.2; and return results, data-version information, and meaningful error/status messages. Browsing and route computation will use the same published data version.

**Data storage:** Keep map metadata, building/entrance records, and the directed route network in files read by the server. A database and user accounts are not required for this MVP. Separate data loading, schedule evaluation, routing, and HTTP handling into modules.

```text
Official maps / floor plans / field records
  → Team review → Versioned JSON files on server

Browser: manual trip input or access-map selection
  → HTTP request → Server: input validation and data loading
  → Server: time/permission checks and candidate-path search
  → HTTP JSON response: records, routes, steps, status, data version
  → Browser: map layers, entrance cards, route comparison, instructions
```

For route queries, the response will distinguish a completed search with routes, a completed search with no feasible route under the recorded rules, and an incomplete search. Invalid inputs will receive a clear validation message. Connection or server failures will be shown as a service error with a retry action, not as evidence that no walkable route exists. Do not present an outdated result as a response to a newly changed query.

The implementation will use **at least one external library beyond the standard library**. An HTTP server framework is a suitable candidate. The team will choose the server language and specific library during the architecture milestone and document the dependency's purpose, version, licence, and build/run steps. The browser languages and SVG format do not themselves satisfy this dependency requirement. No library or working server is claimed to be implemented in Milestone 1.

Accounts, live lock connections, campus-wide GIS, and voice navigation are outside the initial scope. Detailed API paths and deployment tooling will be specified during the architecture milestone.

### 7.2 Proposed search strategy

Start with a small supported network. A shortest-path approach can find a baseline, but edge availability changes with arrival time. Filtering every door once at departure is insufficient.

For an auditable small first version, the server will enumerate candidate paths without repeated nodes while accumulating arrival time, total duration, and exposed distance. At each edge expansion, check permissions, entry/exit windows, and record validity. Find the shortest feasible time, then select the lowest-exposure path within the detour allowance. Edge times are non-negative, allowing over-budget candidates to be pruned.

Apply a search budget, initially configurable at, for example, 200,000 expansions or three seconds. If it is exhausted before search completion, show **Search incomplete; reduce the search area**. A discovered candidate can be shown, but must not be called optimal. A larger network may later use multi-objective labels with time state. A weighted score must not silently replace the user's explicit detour limit.

The first version does not plan waiting for opening doors, voluntary mid-trip stops, live congestion, or rain/wind forecasts. Estimated times should identify whether they come from observations or a consistent walking-speed model.

### 7.3 Drawing route geometry

Use the same coordinate system for network geometry and backgrounds. Show different floors through floor controls or segment cards rather than connecting a multi-floor space arbitrarily on one plane. Building-relationship lines belong to the survey view only. Published geometry follows actual passages and exits, not walls, lawns, or unsupported buildings.

## 8. Collection, review, and maintenance

Interview students about actual trips before choosing priority routes. Combine route recording, entrance photography, and door-access checks in each field visit. The immediate work is described in [README Section 7](README.md#7-next-fieldwork); recording fields and review steps are provided here.

1. Build candidate lists from sources: buildings, official entrance symbols, possible bridges, and floor-plan pages.
2. Record each door's ID, location/side, floor, entry/exit conditions, signs, photographs, and observation time.
3. Walk each candidate passage continuously, documenting floors, turns, stairs/elevators, and the far-side door. Verify intended directions separately.
4. Have a second member independently follow the record. Mark conflicts unknown and suspend affected recommendations.
5. Publish a data version with an editor and reason for each change. Construction, reports, holidays, and policy changes trigger review. A weekly review of critical doors is an initial maintenance proposal; adjust frequency to observed change and effort.

An initial workload budget is 2–3 key buildings and roughly 6–12 doors per area, or 18–36 doors across three areas. These are planning limits, not completed counts. Narrow a complex area to a continuous usable sub-corridor when necessary.

## 9. Planned acceptance scenarios

These are future acceptance criteria. No software or on-site tests are claimed to have been executed for this submission.

| Scenario | Expected behaviour |
|---|---|
| Open the map without a route | Select an area, building, or entrance and inspect information |
| Cross one building | Identify specific doors and floors; do not generate unverified passage instructions |
| Ordinary visitor encounters card access | Explain and exclude the segment; do not suggest borrowing a card or following someone in |
| Only building hours are known | Display building hours while keeping the side door unknown |
| IKB at 21:00 on October 30, 2026 | Apply the date exception instead of recommending entry based on the regular midnight closing time |
| Arrival after a door closes | Exclude the candidate; do not check departure time alone |
| No exposure benefit | Do not invent a second path; explain identical options or absence of a verified alternative |
| Closure, one-way passage, or invalid record | Exclude affected directed edges and update the explanation |
| Zoomed map or mobile display | Keep markers aligned; provide equivalent list access |
| Search budget exhausted | Make incompleteness clear and avoid an unresponsive interface |

## 10. Success measures and evaluation plan

Evaluate information value and route value separately:

- **Data quality:** Every recommended door, direction, permission, time rule, and floor has a traceable record; unknown facts never silently become verified.
- **Map task:** Can a student unfamiliar with a passage find an entrance, identify its constraints, and understand how to cross one building?
- **Displayed-route task:** Across the three representative trips, can students use the line, instructions, and photographs without GPS? Record wrong doors, backtracking, and completion time.
- **Benefit:** Compare exposed distance and extra time under the same endpoints, departure conditions, and recording method. Record zero benefit as well as positive findings.
- **User evaluation:** Invite at least five students as a proposed target, document difficulties and resulting revisions, and acknowledge the small sample.

## 11. Risks and scope reductions

| Risk | Response |
|---|---|
| Three areas require too much data | Keep three maps browsable; publish routes for one complete verified corridor first and expand with explicit boundaries |
| Hours or permissions cannot be established | Preserve Unknown, exclude affected indoor recommendations, retain public outdoor routes |
| Busy student hub has no useful sheltered alternative | Provide access information without promising an unmeasured route benefit |
| Official tools already cover similar paths | Compare information detail, actual benefit, and user tasks; reduce low-value features |
| Access data changes | Record sources, dates, expiry, and reviews; do not claim live door state |
| Old imagery or floor plans | Distinguish source dates from review dates and check against the site and current rules |

## 12. Delivery sequence and definition of completion

1. **Sources and maps:** Fix the three image extents, data model, area choices, and candidate doors.
2. **Complete browsing workflow:** Map → building → entrance → single-building passage card, with sources, status, and dates.
3. **Complete engineering route workflow:** A representative end-to-end trip, on-site passage records, access filtering, baseline/lower-exposure comparison, and instructions.
4. **Expansion and evaluation:** Extend coverage based on science/student-hub findings; complete user-task evaluation and maintenance documentation.

Each stage is independently reviewable. An unverified route remains unverified even under deadline pressure. Update the README as implementation and fieldwork progress, and record the team's supporting assignments on the task board.
