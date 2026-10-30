package hortons.controller;

import hortons.model.Dataset;
import java.util.List;
import static hortons.controller.RouteTypes.*;

/** Stateless coordinator between ApiController, RouteSearch and Dataset. */
public final class RouteController {
    /** Pre: request valid for dataset, arguments non-null.
     * Post: returns versioned COMPLETE with 1-2 options or NO_FEASIBLE_ROUTE with
     * zero options; never represents a service failure as no route. No mutation.
     *
     * @param request validated input
     * @param dataset published data
     * @return route result
     */
    public Result plan(Request request, Dataset dataset) {
        throw new UnsupportedOperationException("TODO: search and construct response options");
    }
    /** Pre: path contains valid continuous edges in dataset; arguments non-null.
     * Post: unmodifiable ordered steps grouping consecutive edges of equal cover;
     * every path edge appears exactly once. Text uses node labels (ID fallback)
     * and summed distances. Does not mutate path or dataset.
     *
     * @param path route to describe
     * @param dataset labels and edge information
     *
     * @return walking instructions
     */
    public List<Step> buildSteps(Path path, Dataset dataset) {
        throw new UnsupportedOperationException("TODO: group edges and describe steps");
    }
    /** Pre: path valid for dataset; arguments non-null.
     * Post: returns one segment per path edge, in traversal order, using endpoint
     * coordinates as geometry under the current data schema. No mutation.
     *
     * @param path selected path
     * @param dataset coordinates and cover types
     *
     * @return unmodifiable segment list
     */
    public List<Segment> buildSegments(Path path, Dataset dataset) {
        throw new UnsupportedOperationException("TODO: build map geometry");
    }
}
