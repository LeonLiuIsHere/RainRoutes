# Backend Skeleton Guide (Milestone 2)

This submission provides interface stubs and specifications, not a working backend.
Business methods explicitly throw `UnsupportedOperationException`, and `App` does
not start an HTTP service yet. Java records define data containers and defensively
copy lists; semantic validation remains to be implemented.

## Reading order

All Java paths below are relative to `src/main/java/hortons/`.

1. `model/NetworkGraph.java`: nodes, directed edges, and outgoing-edge queries.
2. `model/Schedule.java`: weekly opening hours with start-inclusive, end-exclusive intervals.
3. `model/Dataset.java`: the map, buildings, doors, and graph for one published version.
4. `model/DataLoader.java`: reading and validating JSON, then constructing a Dataset.
5. `controller/RouteTypes.java`: shared request, path, and response types.
6. `controller/AccessEvaluator.java`: checking whether an edge's door permits traversal.
7. `controller/RouteSearch.java`: fastest and lower-exposure route searches.
8. `controller/RouteController.java`: coordinating searches and producing segments and steps.
9. `controller/MapController.java`: providing selectable places and map data.
10. `controller/ApiController.java`: validating JSON requests and converting responses.
11. `App.java`: loading data, starting the server, and binding HTTP endpoints.

`RouteTypes` contains shared data types; it is not an additional business controller.

## Request flow

Browser -> ApiController.routes -> RouteController.plan -> RouteSearch.search
-> NetworkGraph.getOutgoingEdges + AccessEvaluator.isUsable -> Schedule.isOpen.

Search results return to RouteController to produce steps and map segments.
ApiController then serializes the response as JSON.

## Current contracts

- Origin and destination are labelled node IDs under the current architecture;
  arbitrary latitude/longitude inputs are not accepted.
- The API retains `maxExtraMinutes`; the internal Request uses seconds.
- Omitted departure uses the current time. User-entered times use America/Vancouver.
- Door access is checked at departure only, not at each predicted arrival time.
- Results use `COMPLETE` or `NO_FEASIBLE_ROUTE`; `PARTIAL_ROUTE` is not included.
- Lower-exposure search follows the architecture's weighted candidate strategy;
  it does not guarantee a globally optimal exposure value.
- Node and Edge follow the existing `network.json` schema. DataLoader must explicitly
  map `x_norm`/`y_norm`, `door_id`, and lower-case cover values to Java types;
  do not assume Jackson automatically handles these conversions.
- A missing Schedule means unknown access and prevents traversal. A present schedule
  with no windows means closed all week. Window uses minutes to represent 24:00;
  DataLoader must convert the existing JSON time strings.
- JSON responses also require explicit handling of Optional, enums, and nested
  results. This conversion is not implemented yet.

## Team decisions to align before submission

1. The current architecture treats every labelled node as selectable. If selection
   is restricted to entrances, update data markers, frontend choices, API validation,
   and architecture documentation consistently.
2. NetworkGraph can represent disconnected networks, but `architecture.md` currently
   requires DataLoader to reject data where selectable nodes are not mutually
   reachable. The loader specification retains that policy. If the team removes it,
   update both the DataLoader specification and architecture.
3. The sample `network.json` only contains N-1 -> N-2, with no reverse edge. It would
   fail the current mutual-reachability check. Treat it as sample data requiring revision.
4. Free-point selection, geolocation, and partial routes remain outside this skeleton;
   update the specifications once the team agrees on their scope.
5. The `images/map.png` reference in `data/map.json` and the existing `data/map.png`
   must be aligned with an accessible static URL during implementation.
6. This work covers the backend only. The team must separately check `requirements.md`,
   frontend component specifications, and overall Milestone 2 completeness.

## Verification scope

All backend Java files passed compilation with `javac --release 21 -Xlint:all`.
This verifies compatible types and method signatures, not working algorithms,
file loading, or HTTP endpoints. Javadoc syntax checks also passed with missing-comment
warnings disabled.

Existing Gradle and IDE files were not changed by this work. No Git commit or push
was performed.
