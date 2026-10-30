package hortons.model;

import java.util.*;

/** One published, immutable server dataset, created by DataLoader.
 * Planned invariant: unique non-blank IDs; all door/building/edge-door references
 * resolve; map dimensions positive; coordinates finite in [0,1].
 * Collection-bearing values below defensively copy lists, but semantic validation
 * remains the responsibility of DataLoader and the Dataset constructor.
 */
public final class Dataset {
    /** Pre: coordinates finite in [0,1]. Post: stores normalized map position.
     *
     * @param xNorm horizontal coordinate
     * @param yNorm vertical coordinate
     */
    public record Point(double xNorm, double yNorm) { }
    /** Pre: ID/name non-blank, outline non-null, >=3 non-null valid points.
     * Post: stores a building with a copied outline.
     *
     * @param id building ID
     * @param name display name
     * @param outline map polygon
     */
    public record Building(String id, String name, List<Point> outline) {
        public Building { outline = List.copyOf(outline); }
    }
    /** Pre: IDs non-blank, schedule Optional non-null.
     * Post: stores a door; absent schedule means UNKNOWN, not always open.
     *
     * @param id door ID
     * @param buildingId owner
     * @param schedule weekly hours
     */
    public record Door(String id, String buildingId, Optional<Schedule> schedule) { }
    /** Pre: imageUrl non-blank; dimensions positive. Post: stores map metadata.
     *
     * @param imageUrl client-accessible image URL
     *
     * @param imageWidth width in pixels
     * @param imageHeight height in pixels
     */
    public record MapInfo(String imageUrl, int imageWidth, int imageHeight) { }

    /** Pre: arguments/elements non-null; version non-blank; graph valid.
     * Post: copies collections and creates a dataset satisfying the invariant.
     *
     * @param dataVersion published version
     * @param graph surveyed network
     *
     * @param map map metadata
     * @param buildings building records
     * @param doors door records
     *
     * @throws IllegalArgumentException if IDs or references are invalid
     */
    public Dataset(String dataVersion, NetworkGraph graph, MapInfo map,
                   Collection<Building> buildings, Collection<Door> doors) {
        throw new UnsupportedOperationException("TODO: validate and copy dataset");
    }
    /** Pre: none. Post: returns version, unchanged dataset.
     * @return published version */
    public String getDataVersion() { throw new UnsupportedOperationException("TODO"); }
    /** Pre: none. Post: returns immutable graph.
     * @return surveyed network */
    public NetworkGraph getGraph() { throw new UnsupportedOperationException("TODO"); }
    /** Pre: none. Post: returns map metadata.
     * @return map description */
    public MapInfo getMap() { throw new UnsupportedOperationException("TODO"); }
    /** Pre: none. Post: returns unmodifiable building list.
     * @return all buildings */
    public List<Building> getBuildings() { throw new UnsupportedOperationException("TODO"); }
    /** Pre: id non-null/non-blank. Post: returns matching door or empty; unchanged.
     *
     * @param id door ID
     * @return matching door if known
     */
    public Optional<Door> getDoor(String id) { throw new UnsupportedOperationException("TODO"); }
    /** Pre: id non-null/non-blank. Post: returns matching building or empty; unchanged.
     *
     * @param id building ID
     * @return matching building if known
     */
    public Optional<Building> getBuilding(String id) { throw new UnsupportedOperationException("TODO"); }
}
