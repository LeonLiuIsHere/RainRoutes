package hortons.model;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * Immutable directed network of surveyed walking paths, shared by server requests.
 * Nodes represent entrances or junctions; edges represent surveyed connections.
 * Door availability and route search belong to the controllers, not this model.
 *
 * <p>Representation invariant for the implementation: node and edge IDs are unique
 * within their respective collections; every edge endpoint exists; coordinates
 * are finite and in [0, 1]; lengths and times are finite and non-negative;
 * exposedM is at most distanceM; indoor edges have zero exposure.
 * Disconnected components are permitted by this graph model.
 *
 * <p>Milestone 2 stub: graph operations deliberately throw until implemented.
 */
public final class NetworkGraph {

    /** Shelter classification of a surveyed edge. */
    public enum Cover { INDOOR, COVERED, OUTDOOR }

    /**
     * Immutable node value. Construction requires a non-blank ID, finite
     * coordinates in [0, 1], and a non-null label Optional containing either
     * no value or a non-blank display name. Produces a value with those fields.
     * These input constraints will be checked when constructing the graph.
     *
     * @param id unique node ID
     * @param xNorm horizontal coordinate relative to map image width
     * @param yNorm vertical coordinate relative to map image height
     * @param label optional display name; labelled nodes are selectable under
     *              the current architecture
     */
    public record Node(String id, double xNorm, double yNorm,
                       Optional<String> label) { }

    /**
     * Immutable directed connection. Construction requires non-blank IDs,
     * finite non-negative measurements, exposedM &lt;= distanceM, a non-null
     * cover and doorId Optional, and zero exposure for INDOOR edges.
     * A present door ID must be non-blank. Produces a value with those fields.
     * These input constraints will be checked when constructing the graph;
     * DataLoader additionally checks that a referenced door exists.
     * A bidirectional path needs two separately identified edges.
     *
     * @param id unique edge ID
     * @param fromNodeId source node ID
     * @param toNodeId destination node ID
     * @param distanceM total length in metres
     * @param walkSeconds estimated walking time in seconds
     * @param exposedM unsheltered length in metres
     * @param cover shelter classification
     * @param doorId optional door whose access rules govern this edge
     */
    public record Edge(String id, String fromNodeId, String toNodeId,
                       double distanceM, double walkSeconds, double exposedM,
                       Cover cover, Optional<String> doorId) { }

    /**
     * Builds a graph from surveyed records.
     * Pre: collections and elements are non-null.
     * Post: contains exactly the supplied records, satisfies the invariant,
     * and does not retain mutable aliases to the input collections.
     * No connectivity between all nodes is required by this constructor.
     *
     * @param nodes nodes to store
     * @param edges directed connections to store
     * @throws NullPointerException if a collection or element is null
     * @throws IllegalArgumentException if a record violates the invariant
     */
    public NetworkGraph(Collection<Node> nodes, Collection<Edge> edges) {
        throw new UnsupportedOperationException("TODO: validate and copy graph data");
    }

    /**
     * Pre: nodeId is non-null and non-blank.
     * Post: returns the matching node, or empty if unknown; graph unchanged.
     * @param nodeId node to look up
     * @return matching node if present
     */
    public Optional<Node> getNode(String nodeId) {
        throw new UnsupportedOperationException("TODO: look up node");
    }

    /**
     * Pre: edgeId is non-null and non-blank.
     * Post: returns the matching edge, or empty if unknown; graph unchanged.
     * @param edgeId edge to look up
     * @return matching edge if present
     */
    public Optional<Edge> getEdge(String edgeId) {
        throw new UnsupportedOperationException("TODO: look up edge");
    }

    /**
     * Pre: nodeId identifies an existing node.
     * Post: returns an unmodifiable list of exactly the edges starting at
     * that node (possibly empty), without filtering door access; graph unchanged.
     * @param nodeId source node
     * @return outgoing edges; order is unspecified
     * @throws IllegalArgumentException if the node is unknown
     */
    public List<Edge> getOutgoingEdges(String nodeId) {
        throw new UnsupportedOperationException("TODO: look up outgoing edges");
    }

    /**
     * Pre: none.
     * Post: returns an unmodifiable list of all nodes; graph unchanged.
     * @return all nodes, in unspecified order
     */
    public List<Node> getNodes() {
        throw new UnsupportedOperationException("TODO: list nodes");
    }
}
