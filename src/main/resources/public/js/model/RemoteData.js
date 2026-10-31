/**
 * Handles fetching data from the backend server APIs.
 */
export class RemoteData {
    /**
     * Fetches metadata from the server.
     * @precondition none
     * @postcondition returns a Promise resolving to the metadata object
     * @returns {Promise<Object>}
     */
    async fetchMetadata() {
        // TODO: implement fetchMetadata using fetch()
        return {};
    }

    /**
     * Fetches map and network data from the server.
     * @precondition none
     * @postcondition returns a Promise resolving to the map/network dataset
     * @returns {Promise<Object>}
     */
    async fetchMapData() {
        // TODO: implement fetchMapData using fetch()
        return {};
    }

    /**
     * Requests route options from the backend.
     * @precondition origin, destination, and time parameters must be valid
     * @postcondition returns a Promise resolving to the computed route options
     * @param {string} origin
     * @param {string} destination
     * @param {string} time
     * @returns {Promise<Object>}
     */
    async fetchRoutes(origin, destination, time) {
        // TODO: implement fetchRoutes using fetch()
        return {};
    }
}