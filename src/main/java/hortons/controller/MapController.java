package hortons.controller;

import hortons.model.Dataset;
import hortons.model.NetworkGraph.Node;
import java.util.List;

/** Stateless startup/map responses built from Dataset for ApiController. */
public final class MapController {
    /** Pre: version non-blank, places non-null containing only labelled nodes.
     * Post: copies places.
     * @param dataVersion published version
     * @param places choices
     */
    public record Meta(String dataVersion, List<Node> places) {
        public Meta { places = List.copyOf(places); }
    }
    /** Pre: fields/elements non-null; values from one dataset version.
     * Post: copies collections.
     * @param dataVersion version
     * @param map background
     *
     * @param buildings outlines
     * @param places labelled selectable nodes
     */
    public record MapData(String dataVersion, Dataset.MapInfo map,
                          List<Dataset.Building> buildings, List<Node> places) {
        public MapData { buildings = List.copyOf(buildings); places = List.copyOf(places); }
    }
    /** Pre: dataset non-null. Post: returns version and all labelled nodes;
     * no mutation.
     * @param dataset published data
     * @return startup form metadata
     */
    public Meta meta(Dataset dataset) {
        throw new UnsupportedOperationException("TODO: select labelled nodes");
    }
    /** Pre: dataset non-null. Post: returns map metadata, outlines and labelled
     * nodes from one version; no mutation.
     * @param dataset data
     * @return map content
     */
    public MapData map(Dataset dataset) {
        throw new UnsupportedOperationException("TODO: assemble map response");
    }
}
