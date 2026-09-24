package com.example.model;

/**
 * Request body for filing a report.
 *
 * @param title a short description, required
 * @param body the full text, optional
 * @param location where the problem is, required
 * @param incidentType what kind of problem it is, optional; one of the IncidentType names
 * @param priority how urgent it is, optional; one of the Priority names
 */
public record CreateReportRequest(
    String title,
    String body,
    String location,
    String incidentType,
    String priority
) {
}
