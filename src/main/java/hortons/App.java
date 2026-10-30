package hortons;

import java.io.IOException;
import java.nio.file.Path;

/** Server startup: DataLoader -> immutable Dataset -> stateless controllers.
 * Eventually starts Javalin, serves resources/public, and binds GET /api/meta,
 * GET /api/map, POST /api/routes to ApiController. Shared data is read-only;
 * each request receives its own search state. This is a Milestone 2 stub.
 */
public final class App {
    private App() { }
    /** Pre: args non-null; zero arguments, or dataDirectory and port.
     * Post: on success starts the server (default data/ and port 7070), or reports
     * invalid configuration/data and fails startup; no partial dataset served.
     *
     * @param args optional data directory and port
     *
     * @throws IOException if data cannot be read
     *
     * @throws IllegalArgumentException if arguments or data are invalid
     */
    public static void main(String[] args) throws IOException {
        throw new UnsupportedOperationException("TODO: parse options, load dataset and start server");
    }
    /** Pre: dataDirectory non-null; 1 &lt;= port &lt;= 65535.
     * Post: loads/validates once, starts HTTP service on port, binds endpoints and
     * static assets; requests share the immutable dataset. Startup failure must
     * release any partially opened server resources.
     *
     * @param dataDirectory JSON source directory
     * @param port listening port
     *
     * @throws IOException if files cannot be read
     *
     * @throws IllegalArgumentException if data is invalid
     *
     * @throws IllegalStateException if HTTP server cannot start
     */
    public static void start(Path dataDirectory, int port) throws IOException {
        throw new UnsupportedOperationException("TODO: Javalin bindings and lifecycle");
    }
}
