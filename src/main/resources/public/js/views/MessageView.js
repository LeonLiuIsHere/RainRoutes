/**
 * Manages user notifications and error messages.
 */
export class MessageView {
    /**
     * Displays an error message to the user.
     * @precondition message string is provided
     * @postcondition error banner or toast is displayed on screen
     * @param {string} message
     */
    showError(message) {
        // TODO: render error message in UI
    }

    /**
     * Displays a loading status indicator.
     * @precondition none
     * @postcondition loading spinner or text is shown
     */
    showLoading() {
        // TODO: show loading indicator
    }

    /**
     * Hides any active loading or message indicators.
     * @precondition none
     * @postcondition messages/spinners are hidden
     */
    hide() {
        // TODO: hide messages and loaders
    }
}