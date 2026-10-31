import { ClientState } from '../model/ClientState.js';
import { RemoteData } from '../model/RemoteData.js';

/**
 * Main controller connecting the UI views and data models.
 */
export class ClientController {
    /**
     * Initializes the client controller.
     * @precondition none
     * @postcondition controller is initialized and event listeners are bound
     */
    constructor() {
        // TODO: instantiate models and views
        this.state = new ClientState();
        this.remoteData = new RemoteData();
    }

    /**
     * Initializes the application on startup.
     * @precondition DOM is fully loaded
     * @postcondition initial data is fetched and UI is rendered
     */
    async init() {
        // TODO: load initial map and metadata
    }

    /**
     * Handles the route search action triggered by the user.
     * @precondition valid inputs are provided in the UI form
     * @postcondition routes are fetched and passed to views for rendering
     */
    async handleSearchRoutes() {
        // TODO: handle route search trigger
    }
}