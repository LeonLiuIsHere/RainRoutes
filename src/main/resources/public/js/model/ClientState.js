/**
 * Represents the client-side application state.
 */
export class ClientState {
    /**
     * Initializes a new instance of ClientState.
     * @precondition none
     * @postcondition a new ClientState object is created with default values
     */
    constructor() {
        // TODO: initialize state properties (origin, destination, time, etc.)
    }

    /**
     * Gets the current selected origin node or building.
     * @precondition none
     * @postcondition returns the current origin identifier or null
     * @returns {string|null}
     */
    getOrigin() {
        // TODO: implement getOrigin
        return null;
    }

    /**
     * Sets the origin identifier.
     * @precondition originId must be a valid string or null
     * @postcondition the origin property is updated
     * @param {string|null} originId
     */
    setOrigin(originId) {
        // TODO: implement setOrigin
    }
}