package hortons.controller;

import hortons.model.Dataset.Point;
import hortons.model.NetworkGraph.Cover;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;

/** Shared in-process request/result types, not additional controllers.
 * Record constructors copy lists, but do not yet validate semantic constraints.
 * Producers must satisfy the documented preconditions. JSON conversion is
 * explicit in ApiController (e.g. enum cover INDOOR -> wire string "indoor").
 */
public final class RouteTypes {
    private RouteTypes() { }
    public enum Status { COMPLETE, NO_FEASIBLE_ROUTE }
    public enum Kind { FASTEST, LOWER_EXPOSURE }

    /** Pre: known distinct labelled node IDs, non-null departure, finite extra >=0.
     * Post: stores validated search input, with allowance converted from minutes.
     *
     * @param origin source node
     * @param destination target node
     *
     * @param departure departure instant
     * @param maxExtraSeconds detour allowance
     */
    public record Request(String origin, String destination, ZonedDateTime departure,
                          double maxExtraSeconds) { }
    /** Pre: edgeIds form a continuous feasible path; totals finite/non-negative
     * and equal edge sums. Post: copies ordered edge IDs and stores totals.
     *
     * @param edgeIds traversal order
     * @param distanceM metres
     * @param walkSeconds seconds
     *
     * @param exposedM unsheltered metres
     */
    public record Path(List<String> edgeIds, double distanceM, double walkSeconds, double exposedM) {
        public Path { edgeIds = List.copyOf(edgeIds); }
    }
    /** Pre: optionals non-null; lowerExposure present only with fastest and must
     * improve exposure within allowance. Post: stores search alternatives.
     *
     * @param fastest empty means no route
     * @param lowerExposure distinct improvement
     */
    public record SearchResult(Optional<Path> fastest, Optional<Path> lowerExposure) { }
    /** Pre: known edge, non-null cover, >=2 valid points. Post: copies geometry.
     *
     * @param edgeId edge ID
     * @param cover shelter
     * @param points normalized polyline
     */
    public record Segment(String edgeId, Cover cover, List<Point> points) {
        public Segment { points = List.copyOf(points); }
    }
    /** Pre: non-blank text and nonempty valid edge IDs. Post: copies step edges.
     *
     * @param text walking instruction
     * @param edgeIds consecutive edges in this step
     */
    public record Step(String text, List<String> edgeIds) {
        public Step { edgeIds = List.copyOf(edgeIds); }
    }
    /** Pre: kind non-null; finite/non-negative metrics; geometry/steps correspond
     * to same path; fastest has zero extra and reduction. Post: copies lists.
     *
     * @param kind option category
     * @param distanceM total length
     *
     * @param walkSeconds total time
     * @param exposedM total exposure
     *
     * @param extraSeconds time above fastest
     * @param exposureReductionM exposure saved
     *
     * @param segments ordered geometry
     * @param steps grouped instructions
     */
    public record Option(Kind kind, double distanceM, double walkSeconds, double exposedM,
                         double extraSeconds, double exposureReductionM,
                         List<Segment> segments, List<Step> steps) {
        public Option { segments = List.copyOf(segments); steps = List.copyOf(steps); }
    }
    /** Pre: version non-blank, status non-null. COMPLETE has 1 or 2 options;
     * identical=true iff COMPLETE has only FASTEST (no distinct improvement).
     * NO_FEASIBLE_ROUTE has no options and identical=false. Post: copies options.
     *
     * @param dataVersion dataset version
     * @param status outcome
     *
     * @param identical whether only the fastest option is offered
     * @param options routes
     */
    public record Result(String dataVersion, Status status, boolean identical, List<Option> options) {
        public Result { options = List.copyOf(options); }
    }
}
