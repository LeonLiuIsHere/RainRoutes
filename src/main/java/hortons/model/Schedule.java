package hortons.model;

import java.time.*;
import java.util.Collection;

/** Server model for weekly opening hours in America/Vancouver.
 * Planned immutable ADT: no mutable aliases; windows are same-day [start, end).
 * Overnight opening must be split at midnight (endMinute may be 1440).
 * Missing schedule is represented by Optional.empty() in Dataset.Door;
 * a present schedule with no windows means closed all week.
 * All operations below are Milestone 2 stubs.
 */
public final class Schedule {
    /** Pre: day non-null, 0 &lt;= startMinute &lt; endMinute &lt;= 1440.
     * Post: stores one weekly window. Validation belongs to Schedule construction.
     *
     * @param day weekday
     *
     * @param startMinute inclusive minute since midnight
     *
     * @param endMinute exclusive minute since midnight
     */
    public record Window(DayOfWeek day, int startMinute, int endMinute) { }

    /** Pre: windows and elements non-null.
     * Post: creates an immutable copy, validating window bounds; overlaps allowed.
     *
     * @param windows weekly open intervals, possibly empty
     *
     * @throws IllegalArgumentException for invalid bounds
     */
    public Schedule(Collection<Window> windows) {
        throw new UnsupportedOperationException("TODO: validate and copy windows");
    }

    /** Pre: time non-null. Post: true iff its Vancouver local time is in a window;
     * does not mutate this schedule. Holidays are not modeled.
     *
     * @param time instant to evaluate, converted to America/Vancouver
     *
     * @return whether the door is scheduled open
     */
    public boolean isOpen(ZonedDateTime time) {
        throw new UnsupportedOperationException("TODO: evaluate weekly opening hours");
    }
}
