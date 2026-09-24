package com.example.controller;

import com.example.auth.Caller;
import com.example.classes.ReportStatus;
import com.example.classes.RequestStatus;
import com.example.model.ActivityResponse;
import com.example.model.AssigneesRequest;
import com.example.model.AssignmentRequestResponse;
import com.example.model.CloseRequestResponse;
import com.example.model.CommentRequest;
import com.example.model.CreateReportRequest;
import com.example.model.DashboardStatsResponse;
import com.example.model.PendingRequestsResponse;
import com.example.model.ReportResponse;
import com.example.model.StatusChangeRequest;
import com.example.service.ReportService;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Report endpoints. Every one of them requires a bearer token; see {@code WebMvcConfig}.
 *
 * The controller only translates HTTP; the rules live in {@link ReportService}. Mapped on two base
 * paths for the reason explained in {@link ApiPaths}.
 */
@RestController
@RequestMapping({ApiPaths.REPORTS, ApiPaths.CLOUD_PREFIX + ApiPaths.REPORTS})
public class ReportController {

    /** Does the work. */
    private final ReportService reportService;

    /**
     * Creates the controller.
     *
     * @param reportService the service holding the rules
     */
    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    /**
     * Lists the reports the caller may see, most recently changed first.
     *
     * @param caller the signed-in employee
     * @param status an exact status name, optional
     * @param location a case-insensitive fragment of the location, optional
     * @param from an ISO date or timestamp; only reports changed on or after it, optional
     * @param to an ISO date or timestamp; only reports changed up to and including it, optional
     * @param completedBy an employee id who must be assigned to the report, optional
     * @param completedOnly only APPROVED and ARCHIVED reports
     * @param openOnly only reports that are not ARCHIVED
     * @return 200 with the matching reports, or 400 when a status or date cannot be parsed
     */
    @GetMapping
    public List<ReportResponse> list(
        Caller caller,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String location,
        @RequestParam(required = false) String from,
        @RequestParam(required = false) String to,
        @RequestParam(required = false) String completedBy,
        @RequestParam(defaultValue = "false") boolean completedOnly,
        @RequestParam(defaultValue = "false") boolean openOnly
    ) {
        return reportService.list(caller, ReportService.Filter.parse(
            status, location, from, to, completedBy, completedOnly, openOnly));
    }

    /**
     * Returns the dashboard numbers for the caller's team.
     *
     * @param caller the signed-in faculty admin
     * @return 200 with the statistics, or 403 for anyone who is not a faculty admin
     */
    @GetMapping("/stats")
    public DashboardStatsResponse stats(Caller caller) {
        return reportService.stats(caller);
    }

    /**
     * Returns the caller's approval queue.
     *
     * @param caller the signed-in faculty admin
     * @param status which requests to include; PENDING unless told otherwise
     * @return 200 with the queue, 400 for an unknown status, or 403 for anyone who is not a faculty
     *     admin
     */
    @GetMapping("/requests")
    public PendingRequestsResponse requests(
        Caller caller,
        @RequestParam(defaultValue = "PENDING") String status
    ) {
        return reportService.requests(caller, RequestStatus.of(status));
    }

    /**
     * Files a report.
     *
     * @param request the title, body and location
     * @param caller the signed-in employee, who becomes the author
     * @param httpRequest the current request, used to build the Location header
     * @return 201 with the new report, or 400 when the title or location is missing
     */
    @PostMapping
    public ResponseEntity<ReportResponse> create(
        @RequestBody CreateReportRequest request,
        Caller caller,
        HttpServletRequest httpRequest
    ) {
        ReportResponse created = reportService.create(request, caller);
        // Built from the request path rather than the host, for the reason given in
        // FacultyAdminController.create.
        URI location = URI.create(httpRequest.getRequestURI() + "/" + created.reportId());
        return ResponseEntity.created(location).body(created);
    }

    /**
     * Returns one report with its full thread.
     *
     * @param reportId the report
     * @param caller the signed-in employee
     * @return 200 with the report, 403 when the caller may not see it, or 404 when it does not exist
     */
    @GetMapping("/{reportId}")
    public ReportResponse get(@PathVariable String reportId, Caller caller) {
        return reportService.get(reportId, caller);
    }

    /**
     * Adds a comment to a report's thread.
     *
     * @param reportId the report
     * @param request the comment
     * @param caller the signed-in employee
     * @return 201 with the new entry, 400 for a blank comment, or 403 when the caller may not see the
     *     report
     */
    @PostMapping("/{reportId}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public ActivityResponse comment(
        @PathVariable String reportId,
        @RequestBody CommentRequest request,
        Caller caller
    ) {
        return reportService.comment(reportId, request == null ? null : request.body(), caller);
    }

    /**
     * Moves a report to a new lifecycle state.
     *
     * @param reportId the report
     * @param request the state to move to
     * @param caller the signed-in employee
     * @return 200 with the updated report, 400 for an unknown status, 403 when the caller may not
     *     make that move, or 409 when the move is not legal from the current state
     */
    @PatchMapping("/{reportId}/status")
    public ReportResponse changeStatus(
        @PathVariable String reportId,
        @RequestBody StatusChangeRequest request,
        Caller caller
    ) {
        if (request == null || request.status() == null || request.status().isBlank()) {
            throw new IllegalArgumentException("status must not be blank");
        }
        return reportService.transition(reportId, ReportStatus.of(request.status()), caller);
    }

    /**
     * Replaces the set of engineers on a report.
     *
     * @param reportId the report
     * @param request the complete set of engineer ids
     * @param caller the signed-in faculty admin
     * @return 200 with the updated report, 400 when an id is not an engineer on the caller's team,
     *     403 for anyone who is not a faculty admin, or 409 when the report is archived
     */
    @PutMapping("/{reportId}/assignees")
    public ReportResponse assign(
        @PathVariable String reportId,
        @RequestBody AssigneesRequest request,
        Caller caller
    ) {
        return reportService.assignEngineers(
            reportId, request == null ? List.of() : request.engineerIds(), caller);
    }

    /**
     * Asks to be put on an unassigned report.
     *
     * @param reportId the report
     * @param caller the signed-in engineer
     * @return 201 with the pending request, 403 for anyone who is not an engineer on the report's
     *     team, or 409 when the report is not unassigned or was already requested
     */
    @PostMapping("/{reportId}/assignment-requests")
    @ResponseStatus(HttpStatus.CREATED)
    public AssignmentRequestResponse requestAssignment(
        @PathVariable String reportId,
        Caller caller
    ) {
        return reportService.requestAssignment(reportId, caller);
    }

    /**
     * Asks for a report to be closed.
     *
     * @param reportId the report
     * @param caller the signed-in author
     * @return 201 with the pending request, 403 for anyone but the author, or 409 when the report is
     *     archived or a request is already open
     */
    @PostMapping("/{reportId}/close-requests")
    @ResponseStatus(HttpStatus.CREATED)
    public CloseRequestResponse requestClose(@PathVariable String reportId, Caller caller) {
        return reportService.requestClose(reportId, caller);
    }

    /**
     * Grants an engineer's request to be put on a report.
     *
     * @param requestId the request
     * @param caller the signed-in faculty admin
     * @return 200 with the updated report, 403 for anyone who is not a faculty admin, 404 for an
     *     unknown request, or 409 when it was already decided
     */
    @PostMapping("/assignment-requests/{requestId}/approve")
    public ReportResponse approveAssignment(@PathVariable String requestId, Caller caller) {
        return reportService.approveAssignmentRequest(requestId, caller);
    }

    /**
     * Refuses an engineer's request to be put on a report.
     *
     * @param requestId the request
     * @param caller the signed-in faculty admin
     * @return 200 with the declined request, 403 for anyone who is not a faculty admin, 404 for an
     *     unknown request, or 409 when it was already decided
     */
    @PostMapping("/assignment-requests/{requestId}/decline")
    public AssignmentRequestResponse declineAssignment(
        @PathVariable String requestId,
        Caller caller
    ) {
        return reportService.declineAssignmentRequest(requestId, caller);
    }

    /**
     * Confirms an author's request to close their report, archiving it.
     *
     * @param requestId the request
     * @param caller the signed-in faculty admin
     * @return 200 with the archived report, 403 for anyone who is not a faculty admin, 404 for an
     *     unknown request, or 409 when it was already decided or the report is unassigned
     */
    @PostMapping("/close-requests/{requestId}/approve")
    public ReportResponse approveClose(@PathVariable String requestId, Caller caller) {
        return reportService.approveCloseRequest(requestId, caller);
    }

    /**
     * Refuses an author's request to close their report.
     *
     * @param requestId the request
     * @param caller the signed-in faculty admin
     * @return 200 with the declined request, 403 for anyone who is not a faculty admin, 404 for an
     *     unknown request, or 409 when it was already decided
     */
    @PostMapping("/close-requests/{requestId}/decline")
    public CloseRequestResponse declineClose(@PathVariable String requestId, Caller caller) {
        return reportService.declineCloseRequest(requestId, caller);
    }
}
