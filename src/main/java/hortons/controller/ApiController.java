package hortons.controller;

import hortons.model.Dataset;
import java.time.Clock;
import java.util.List;

/** HTTP boundary: parses JSON with Jackson, invokes controllers, serializes JSON.
 * Javalin binding belongs in App; these methods stay independent of HTTP framework.
 * Every JSON response includes dataVersion. Exceptions become 500 INTERNAL_ERROR;
 * do not expose stack traces or convert failures into NO_FEASIBLE_ROUTE.
 * Stateless; injected Clock makes omitted departure deterministic in tests.
 */
public final class ApiController {
    /** Pre: status is a valid HTTP code and json is valid non-null JSON including
     * dataVersion. Post: stores response.
     * @param statusCode HTTP code
     * @param json body
     */
    public record HttpResponse(int statusCode, String json) { }
    /** Pre: field/problem non-blank. Post: stores validation issue.
     *
     * @param field input field
     * @param problem machine-readable reason
     */
    public record FieldError(String field, String problem) { }
    /** Pre: code non-blank, fields/elements non-null. Post: copies fields.
     *
     * @param code VALIDATION_ERROR or INTERNAL_ERROR
     * @param fields input problems
     */
    public record ErrorDetail(String code, List<FieldError> fields) {
        public ErrorDetail { fields = List.copyOf(fields); }
    }
    /** Pre: dataset non-null. Post: returns 200 with metadata or 500 on internal
     * failure; no dataset mutation.
     * @param dataset published data
     * @return HTTP JSON
     */
    public HttpResponse meta(Dataset dataset) {
        throw new UnsupportedOperationException("TODO: GET /api/meta");
    }
    /** Pre: dataset non-null. Post: returns 200 with map data or 500 on internal
     * failure; no dataset mutation.
     * @param dataset published data
     * @return HTTP JSON
     */
    public HttpResponse map(Dataset dataset) {
        throw new UnsupportedOperationException("TODO: GET /api/map");
    }
    /** Pre: body, dataset and clock non-null (body need not be valid JSON).
     * Post: returns 400 VALIDATION_ERROR for malformed JSON, missing/unknown or
     * identical endpoints, unlabelled endpoints, invalid departure, or missing,
     * non-finite/negative maxExtraMinutes. Departure is optional; use clock if
     * absent, otherwise parse local ISO date-time in America/Vancouver. Reject
     * nonexistent DST times; resolve ambiguous times with the earlier offset.
     * Converts allowance to finite seconds (reject overflow). Returns 200 for a
     * normal route result, including no route, and 500 for internal failures.
     * Does not mutate inputs or retain request state between calls.
     *
     * @param body raw JSON with origin/destination/departure/maxExtraMinutes
     *
     * @param dataset published data
     * @param clock current-time source
     *
     * @return HTTP response with versioned JSON
     */
    public HttpResponse routes(String body, Dataset dataset, Clock clock) {
        throw new UnsupportedOperationException("TODO: validate request and serialize route result");
    }
}
