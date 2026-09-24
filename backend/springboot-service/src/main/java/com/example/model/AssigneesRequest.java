package com.example.model;

import java.util.List;

/**
 * Request body naming the complete set of engineers who should be on a report.
 *
 * The whole set rather than a delta, so the request describes the state wanted and repeating it
 * changes nothing. An empty list unassigns everyone.
 *
 * @param engineerIds the employee ids of the engineers to assign
 */
public record AssigneesRequest(
    List<String> engineerIds
) {
}
