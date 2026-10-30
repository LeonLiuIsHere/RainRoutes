package hortons.controller;

import hortons.model.Dataset;
import java.util.Optional;
import static hortons.controller.RouteTypes.*;

/** Stateless route search; all queues/distances/predecessors must be request-local.
 * Uses NetworkGraph outgoing edges and AccessEvaluator. Per current architecture,
 * checks access at departure only, not predicted arrival at each door.
 */
public final class RouteSearch {
    /** Pre: request valid for dataset; arguments non-null.
     * Post: returns fastest and optional distinct lower-exposure route; no mutation.
     * If no feasible route exists, both optionals are empty.
     *
     * @param request validated input
     * @param dataset immutable published data
     *
     * @return route alternatives
     */
    public SearchResult search(Request request, Dataset dataset) {
        throw new UnsupportedOperationException("TODO: coordinate both searches");
    }
    /** Pre: request valid for dataset; arguments non-null.
     * Post: returns a continuous usable path minimizing walking seconds, or empty
     * if unreachable. Equal-cost ties may select either path. No mutation.
     *
     * @param request input endpoints/departure
     * @param dataset graph and door data
     *
     * @return fastest path if one exists
     */
    public Optional<Path> fastest(Request request, Dataset dataset) {
        throw new UnsupportedOperationException("TODO: Dijkstra using walking seconds");
    }
    /** Pre: arguments non-null; baseline is fastest for this request/dataset.
     * Post: among baseline and Dijkstra candidates with lambda = 1,2,5,10,20 s/m,
     * chooses least exposure within baseline time + maxExtraSeconds; ties use
     * less time. Returns empty unless exposure strictly improves on baseline.
     * This heuristic does NOT guarantee globally minimum exposure. No mutation.
     *
     * @param request endpoints, departure and allowance
     * @param baseline fastest path
     *
     * @param dataset graph/door data
     * @return distinct lower-exposure candidate
     */
    public Optional<Path> lowerExposure(Request request, Path baseline, Dataset dataset) {
        throw new UnsupportedOperationException("TODO: weighted Dijkstra candidates and detour filter");
    }
}
