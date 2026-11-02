package hortons.controller;

import hortons.model.Dataset;
import hortons.model.NetworkGraph.Edge;
import java.time.ZonedDateTime;

/** Stateless server policy for door access, used by RouteSearch.
 * A missing schedule means UNKNOWN and is not usable.
 */
public final class AccessEvaluator {
    /** Pre: non-null arguments; edge belongs to the validated dataset.
     * Post: true iff edge has no door or its door has a schedule open at time.
     * No input mutation. An unresolved door is a dataset error, not an open door.
     *
     * @param edge candidate connection
     * @param time access-check instant
     *
     * @param dataset door definitions
     * @return whether traversal is permitted
     *
     * @throws IllegalArgumentException if the referenced door does not exist
     */
    public boolean isUsable(Edge edge, ZonedDateTime time, Dataset dataset) {
        throw new UnsupportedOperationException("TODO: resolve door and evaluate schedule");
    }
}
