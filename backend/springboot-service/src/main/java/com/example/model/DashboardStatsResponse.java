package com.example.model;

/**
 * The numbers on a faculty admin's dashboard, scoped to what that admin can see.
 *
 * @param incidentsToday reports filed today, in UTC
 * @param openCases reports not yet archived
 * @param unassigned reports nobody has been put on
 * @param availableEngineers engineers on the team with no report in ASSIGNED or IN_PROGRESS
 * @param totalEngineers engineers on the team
 * @param pendingApprovals requests of both kinds waiting on the admin
 */
public record DashboardStatsResponse(
    long incidentsToday,
    long openCases,
    long unassigned,
    long availableEngineers,
    long totalEngineers,
    long pendingApprovals
) {
}
