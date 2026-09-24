package com.example.service;

import com.example.auth.Caller;
import com.example.auth.EmployeeDirectory;
import com.example.auth.EmployeeDirectory.Snapshot;
import com.example.auth.ForbiddenException;
import com.example.classes.AccessLevel;
import com.example.classes.ActivityKind;
import com.example.classes.Engineer;
import com.example.classes.IncidentType;
import com.example.classes.Priority;
import com.example.classes.Report;
import com.example.classes.ReportActivity;
import com.example.classes.ReportAssignment;
import com.example.classes.ReportRequest;
import com.example.classes.ReportStatus;
import com.example.classes.RequestStatus;
import com.example.classes.RequestType;
import com.example.model.ActivityResponse;
import com.example.model.AssigneeResponse;
import com.example.model.AssignmentRequestResponse;
import com.example.model.CloseRequestResponse;
import com.example.model.CreateReportRequest;
import com.example.model.DashboardStatsResponse;
import com.example.model.EmployeeSummary;
import com.example.model.PendingRequestsResponse;
import com.example.model.ReportResponse;
import com.example.repos.ReportActivityRepository;
import com.example.repos.ReportAssignmentRepository;
import com.example.repos.ReportRepository;
import com.example.repos.ReportRequestRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.stream.Stream;
import org.springframework.stereotype.Service;

/**
 * Everything the report endpoints do, and who may do it.
 *
 * Visibility follows teams. A team is a faculty admin together with the engineers they manage, and a
 * report belongs to a team when its author or any assignee is on it. Authors always see their own
 * reports; an engineer additionally sees anything they are assigned to and anything on their team;
 * a faculty admin sees everything on theirs. A plain employee is on no team and sees only their own.
 *
 * A report whose author is on no team (a plain employee, or an unmanaged engineer) is shared: every
 * faculty admin and every engineer sees it, since otherwise nobody could pick it up.
 *
 * Two things a person may ask for go through a faculty admin instead of happening directly: an
 * engineer being put on a report, and an author having their report closed. Both are recorded as a
 * {@link ReportRequest} and take effect only when approved.
 *
 * Status and the grant table describe the same fact from two sides, so any method that changes one
 * changes the other in the same call.
 */
@Service
public class ReportService {

    /** The forward path taken when a close request is approved. */
    private static final Map<ReportStatus, ReportStatus> FORWARD = new EnumMap<>(Map.of(
        ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS,
        ReportStatus.IN_PROGRESS, ReportStatus.SUBMITTED,
        ReportStatus.SUBMITTED, ReportStatus.APPROVED,
        ReportStatus.APPROVED, ReportStatus.ARCHIVED));

    /** Stores the reports. */
    private final ReportRepository reports;

    /** Stores who is on which report. */
    private final ReportAssignmentRepository assignments;

    /** Stores each report's thread. */
    private final ReportActivityRepository activities;

    /** Stores the approval queue. */
    private final ReportRequestRepository requests;

    /** Resolves people and teams. */
    private final EmployeeDirectory directory;

    /**
     * Creates the service.
     *
     * @param reports the report repository
     * @param assignments the grant repository
     * @param activities the activity repository
     * @param requests the request repository
     * @param directory the employee lookup
     */
    public ReportService(
        ReportRepository reports,
        ReportAssignmentRepository assignments,
        ReportActivityRepository activities,
        ReportRequestRepository requests,
        EmployeeDirectory directory
    ) {
        this.reports = reports;
        this.assignments = assignments;
        this.activities = activities;
        this.requests = requests;
        this.directory = directory;
    }

    /**
     * What a listing may be narrowed by. Every field is optional.
     *
     * @param status an exact lifecycle state, or null
     * @param location a case-insensitive fragment of the location, or null
     * @param from the earliest last-modified time to include, or null
     * @param toExclusive the last-modified time to stop before, or null
     * @param completedBy an employee id that must hold a grant on the report, or null
     * @param completedOnly only APPROVED and ARCHIVED reports
     * @param openOnly only reports that are not ARCHIVED
     */
    public record Filter(
        ReportStatus status,
        String location,
        Instant from,
        Instant toExclusive,
        String completedBy,
        boolean completedOnly,
        boolean openOnly
    ) {

        /**
         * Parses the query string form of a filter.
         *
         * @param status a status name, or null
         * @param location a location fragment, or null
         * @param from an ISO date or timestamp, or null
         * @param to an ISO date or timestamp, or null; a date includes the whole of that day
         * @param completedBy an employee id, or null
         * @param completedOnly whether to keep only completed reports
         * @param openOnly whether to keep only open reports
         * @return the filter
         * @throws IllegalArgumentException if a status or date cannot be parsed
         */
        public static Filter parse(
            String status,
            String location,
            String from,
            String to,
            String completedBy,
            boolean completedOnly,
            boolean openOnly
        ) {
            return new Filter(
                blank(status) ? null : ReportStatus.of(status),
                blank(location) ? null : location.trim(),
                blank(from) ? null : parseBound(from, "from", false),
                blank(to) ? null : parseBound(to, "to", true),
                blank(completedBy) ? null : completedBy,
                completedOnly,
                openOnly);
        }

        /**
         * Parses a date or timestamp bound.
         *
         * @param value the text
         * @param name the parameter name, for the error message
         * @param upper whether this is the upper bound, in which case a date means the end of it
         * @return the instant
         * @throws IllegalArgumentException if the text is neither an ISO date nor an ISO timestamp
         */
        private static Instant parseBound(String value, String name, boolean upper) {
            String text = value.trim();
            try {
                Instant instant = Instant.parse(text);
                return upper ? instant.plusMillis(1) : instant;
            } catch (java.time.format.DateTimeParseException notInstant) {
                try {
                    LocalDate day = LocalDate.parse(text);
                    return (upper ? day.plusDays(1) : day).atStartOfDay(ZoneOffset.UTC).toInstant();
                } catch (java.time.format.DateTimeParseException notDate) {
                    throw new IllegalArgumentException(
                        name + " must be an ISO date (yyyy-MM-dd) or timestamp, not '" + value + "'");
                }
            }
        }

        private static boolean blank(String value) {
            return value == null || value.isBlank();
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------------------------------------

    /**
     * Lists the reports the caller may see, most recently changed first.
     *
     * @param caller who is asking
     * @param filter what to narrow by
     * @return the matching reports, without their threads
     */
    public List<ReportResponse> list(Caller caller, Filter filter) {
        Snapshot people = directory.snapshot();
        return reports.findAll().stream()
            .filter(report -> visible(report, caller, people))
            .filter(report -> filter.status() == null || report.getStatus() == filter.status())
            .filter(report -> filter.location() == null
                || report.getLocation().toLowerCase().contains(filter.location().toLowerCase()))
            .filter(report -> !filter.completedOnly()
                || report.getStatus() == ReportStatus.APPROVED
                || report.getStatus() == ReportStatus.ARCHIVED)
            .filter(report -> !filter.openOnly() || report.getStatus() != ReportStatus.ARCHIVED)
            .filter(report -> filter.from() == null || !report.getUpdatedAt().isBefore(filter.from()))
            .filter(report -> filter.toExclusive() == null
                || report.getUpdatedAt().isBefore(filter.toExclusive()))
            .filter(report -> filter.completedBy() == null
                || assignments.find(report.getReportId(), filter.completedBy()).isPresent())
            .sorted(Comparator.comparing(Report::getUpdatedAt).reversed())
            .map(report -> toResponse(report, people))
            .toList();
    }

    /**
     * Returns one report with its thread.
     *
     * @param reportId the report
     * @param caller who is asking
     * @return the report
     * @throws NoSuchElementException if there is no such report
     * @throws ForbiddenException if the caller may not see it
     */
    public ReportResponse get(String reportId, Caller caller) {
        Snapshot people = directory.snapshot();
        Report report = require(reportId);
        requireVisible(report, caller, people);
        List<ActivityResponse> thread = activities.findByReport(reportId).stream()
            .map(entry -> ActivityResponse.from(entry, summary(entry.authorId(), people)))
            .toList();
        return toResponse(report, people).withActivity(thread);
    }

    /**
     * Returns the requests in the given state on reports the faculty admin can see.
     *
     * @param caller the faculty admin
     * @param status which requests to include
     * @return the queue, split by kind
     * @throws ForbiddenException if the caller is not a faculty admin
     */
    public PendingRequestsResponse requests(Caller caller, RequestStatus status) {
        requireFacultyAdmin(caller, "view the approval queue");
        Snapshot people = directory.snapshot();
        List<ReportRequest> inScope = requests.findAll().stream()
            .filter(request -> request.status() == status)
            .filter(request -> reports.findById(request.reportId())
                .filter(report -> visible(report, caller, people))
                .isPresent())
            .toList();
        return new PendingRequestsResponse(
            inScope.stream()
                .filter(request -> request.type() == RequestType.ASSIGNMENT)
                .map(request -> AssignmentRequestResponse.from(
                    request,
                    summary(request.requestedBy(), people),
                    toResponse(require(request.reportId()), people)))
                .toList(),
            inScope.stream()
                .filter(request -> request.type() == RequestType.CLOSE)
                .map(request -> CloseRequestResponse.from(
                    request,
                    summary(request.requestedBy(), people),
                    toResponse(require(request.reportId()), people)))
                .toList());
    }

    /**
     * Returns the dashboard numbers for a faculty admin's team.
     *
     * @param caller the faculty admin
     * @return the statistics
     * @throws ForbiddenException if the caller is not a faculty admin
     */
    public DashboardStatsResponse stats(Caller caller) {
        requireFacultyAdmin(caller, "view team statistics");
        Snapshot people = directory.snapshot();
        List<Report> visible = reports.findAll().stream()
            .filter(report -> visible(report, caller, people))
            .toList();

        Instant startOfToday = LocalDate.now(ZoneOffset.UTC).atStartOfDay(ZoneOffset.UTC).toInstant();
        Set<String> busy = new HashSet<>();
        visible.stream()
            .filter(report -> report.getStatus() == ReportStatus.ASSIGNED
                || report.getStatus() == ReportStatus.IN_PROGRESS)
            .flatMap(report -> assignments.findByReport(report.getReportId()).stream())
            .forEach(grant -> busy.add(grant.assigneeId()));
        List<Engineer> team = people.engineersOf(caller.employeeId());
        PendingRequestsResponse pending = requests(caller, RequestStatus.PENDING);

        return new DashboardStatsResponse(
            visible.stream().filter(report -> !report.getCreatedAt().isBefore(startOfToday)).count(),
            visible.stream().filter(report -> report.getStatus() != ReportStatus.ARCHIVED).count(),
            visible.stream().filter(report -> report.getStatus() == ReportStatus.UNASSIGNED).count(),
            team.stream().filter(engineer -> !busy.contains(engineer.getEmployeeId())).count(),
            team.size(),
            pending.assignmentRequests().size() + pending.closeRequests().size());
    }

    // ---------------------------------------------------------------------------------------------
    // Writes: anyone signed in
    // ---------------------------------------------------------------------------------------------

    /**
     * Files a report, UNASSIGNED and authored by the caller.
     *
     * @param request what to file
     * @param caller who is filing it
     * @return the new report
     * @throws IllegalArgumentException if the title or location is missing, or the incident type or
     *     priority is not a known value
     */
    public ReportResponse create(CreateReportRequest request, Caller caller) {
        if (request == null) {
            throw new IllegalArgumentException("A request body is required");
        }
        requireText(request.title(), "title");
        requireText(request.location(), "location");
        IncidentType incidentType = IncidentType.of(request.incidentType());
        Priority priority = Priority.of(request.priority());

        String reportId;
        do {
            reportId = Ids.next("RPT");
        } while (reports.existsById(reportId));

        Report report = reports.save(new Report(
            reportId,
            request.title().trim(),
            request.body() == null ? "" : request.body().trim(),
            request.location().trim(),
            caller.employeeId())
            .classify(incidentType, priority));
        return toResponse(report, directory.snapshot());
    }

    /**
     * Adds a comment to a report's thread.
     *
     * @param reportId the report
     * @param body the comment
     * @param caller who is commenting
     * @return the new entry
     * @throws IllegalArgumentException if the comment is blank
     * @throws ForbiddenException if the caller may not see the report
     */
    public ActivityResponse comment(String reportId, String body, Caller caller) {
        requireText(body, "body");
        Snapshot people = directory.snapshot();
        Report report = require(reportId);
        requireVisible(report, caller, people);
        ReportActivity entry = record(report.getReportId(), ActivityKind.COMMENT, caller, body.trim());
        return ActivityResponse.from(entry, summary(caller.employeeId(), people));
    }

    /**
     * Asks for a report to be closed. Nothing changes until a faculty admin confirms.
     *
     * @param reportId the report
     * @param caller the author, or a faculty admin acting for them
     * @return the pending request
     * @throws ForbiddenException if the caller is neither the author nor a faculty admin who can
     *     see the report
     * @throws IllegalStateException if the report is already archived or a request is already open
     */
    public CloseRequestResponse requestClose(String reportId, Caller caller) {
        Snapshot people = directory.snapshot();
        Report report = require(reportId);
        boolean author = caller.employeeId().equals(report.getAuthorId());
        if (!author && !(caller.isFacultyAdmin() && visible(report, caller, people))) {
            throw new ForbiddenException("Only the report's author can request a close");
        }
        if (report.getStatus() == ReportStatus.ARCHIVED) {
            throw new IllegalStateException("Report " + reportId + " is already archived");
        }
        if (pending(reportId, RequestType.CLOSE).findAny().isPresent()) {
            throw new IllegalStateException("A close request is already awaiting confirmation");
        }
        ReportRequest request = requests.save(
            ReportRequest.pending(Ids.next("REQ"), reportId, RequestType.CLOSE, caller.employeeId()));
        record(reportId, ActivityKind.REQUEST, caller, "Requested to close this report");
        return CloseRequestResponse.from(request, summary(caller.employeeId(), people), null);
    }

    // ---------------------------------------------------------------------------------------------
    // Writes: engineers
    // ---------------------------------------------------------------------------------------------

    /**
     * Asks to be put on an unassigned report. Routed to the faculty admin; nothing is assigned yet.
     *
     * @param reportId the report
     * @param caller the engineer asking
     * @return the pending request
     * @throws ForbiddenException if the caller is not an engineer who can see the report
     * @throws IllegalStateException if the report is not UNASSIGNED or the engineer already asked
     */
    public AssignmentRequestResponse requestAssignment(String reportId, Caller caller) {
        Snapshot people = directory.snapshot();
        Report report = require(reportId);
        if (caller.isFacultyAdmin()) {
            throw new ForbiddenException(
                "Faculty admins take reports directly: add yourself with PUT /reports/{id}/assignees");
        }
        if (!caller.isEngineer() || !visible(report, caller, people)) {
            throw new ForbiddenException("Only an engineer on this team can request this report");
        }
        if (report.getStatus() != ReportStatus.UNASSIGNED) {
            throw new IllegalStateException("Only unassigned reports can be requested");
        }
        if (pending(reportId, RequestType.ASSIGNMENT)
                .anyMatch(request -> request.requestedBy().equals(caller.employeeId()))) {
            throw new IllegalStateException("You have already requested this report");
        }
        ReportRequest request = requests.save(ReportRequest.pending(
            Ids.next("REQ"), reportId, RequestType.ASSIGNMENT, caller.employeeId()));
        record(reportId, ActivityKind.REQUEST, caller, "Requested assignment");
        return AssignmentRequestResponse.from(request, summary(caller.employeeId(), people), null);
    }

    /**
     * Moves a report to a new lifecycle state.
     *
     * An assigned engineer may start work and submit it. Everything else — approving, sending back,
     * archiving, and returning a report to UNASSIGNED — is a faculty admin's call. Moving to
     * UNASSIGNED withdraws every grant in the same step, so status and the grant table agree.
     *
     * @param reportId the report
     * @param next the state to move to
     * @param caller who is moving it
     * @return the updated report
     * @throws ForbiddenException if the caller may not make this move
     * @throws IllegalStateException if the move is not legal from the current state
     */
    public ReportResponse transition(String reportId, ReportStatus next, Caller caller) {
        Snapshot people = directory.snapshot();
        Report report = require(reportId);
        requireVisible(report, caller, people);

        if (!caller.isFacultyAdmin()) {
            if (assignments.find(reportId, caller.employeeId()).isEmpty()) {
                throw new ForbiddenException(
                    "Only an assigned engineer or a faculty admin can change this report");
            }
            boolean engineersMove =
                (next == ReportStatus.IN_PROGRESS && report.getStatus() == ReportStatus.ASSIGNED)
                    || (next == ReportStatus.SUBMITTED && report.getStatus() == ReportStatus.IN_PROGRESS);
            if (!engineersMove) {
                throw new ForbiddenException("Only a faculty admin can move a report to " + next);
            }
        }

        move(report, next, caller);
        if (next == ReportStatus.UNASSIGNED) {
            List<ReportAssignment> grants = assignments.findByReport(reportId);
            grants.forEach(grant -> assignments.revoke(reportId, grant.assigneeId()));
            if (!grants.isEmpty()) {
                record(reportId, ActivityKind.ASSIGNMENT, caller,
                    "Unassigned " + names(grants.stream().map(ReportAssignment::assigneeId), people));
            }
        }
        reports.save(report);
        return toResponse(report, people);
    }

    // ---------------------------------------------------------------------------------------------
    // Writes: faculty admins
    // ---------------------------------------------------------------------------------------------

    /**
     * Replaces the set of people working a report: engineers on the caller's team, and the calling
     * faculty admin themselves, which is how an admin takes a case.
     *
     * Grants are issued at CONTRIBUTOR level. Any pending request from an engineer who is now on the
     * report is approved as a side effect, and the status is kept in step: putting the first person
     * on an UNASSIGNED report moves it to ASSIGNED, and taking the last person off an ASSIGNED one
     * moves it back.
     *
     * @param reportId the report
     * @param engineerIds the complete set of people who should be on it
     * @param caller the faculty admin
     * @return the updated report
     * @throws ForbiddenException if the caller is not a faculty admin who can see the report
     * @throws IllegalArgumentException if any id is neither the caller nor an engineer on their team
     * @throws IllegalStateException if the report is archived
     */
    public ReportResponse assignEngineers(String reportId, List<String> engineerIds, Caller caller) {
        requireFacultyAdmin(caller, "assign engineers");
        Snapshot people = directory.snapshot();
        Report report = require(reportId);
        requireVisible(report, caller, people);
        if (report.getStatus() == ReportStatus.ARCHIVED) {
            throw new IllegalStateException("Archived reports cannot be assigned");
        }
        Set<String> wanted = new LinkedHashSet<>(engineerIds == null ? List.of() : engineerIds);
        for (String id : wanted) {
            // The admin themselves is allowed: that is how a faculty admin takes a case.
            boolean allowed = caller.is(id) || people.find(id)
                .filter(Engineer.class::isInstance)
                .map(Engineer.class::cast)
                .filter(engineer -> caller.employeeId().equals(engineer.getFacultyAdminId()))
                .isPresent();
            if (!allowed) {
                throw new IllegalArgumentException(id + " is not you or an engineer on your team");
            }
        }

        Set<String> current = new LinkedHashSet<>();
        assignments.findByReport(reportId).forEach(grant -> current.add(grant.assigneeId()));
        List<String> removed = current.stream().filter(id -> !wanted.contains(id)).toList();
        List<String> added = wanted.stream().filter(id -> !current.contains(id)).toList();

        removed.forEach(id -> assignments.revoke(reportId, id));
        added.forEach(id -> assignments.grant(ReportAssignment.issued(
            reportId, id, AccessLevel.CONTRIBUTOR, caller.employeeId())));
        if (!removed.isEmpty()) {
            record(reportId, ActivityKind.ASSIGNMENT, caller,
                "Unassigned " + names(removed.stream(), people));
        }
        if (!added.isEmpty()) {
            record(reportId, ActivityKind.ASSIGNMENT, caller,
                "Assigned " + names(added.stream(), people));
        }

        pending(reportId, RequestType.ASSIGNMENT)
            .filter(request -> wanted.contains(request.requestedBy()))
            .forEach(request -> requests.save(
                request.resolve(RequestStatus.APPROVED, caller.employeeId())));

        if (!wanted.isEmpty() && report.getStatus() == ReportStatus.UNASSIGNED) {
            move(report, ReportStatus.ASSIGNED, caller);
        } else if (wanted.isEmpty() && report.getStatus() == ReportStatus.ASSIGNED) {
            move(report, ReportStatus.UNASSIGNED, caller);
        }
        reports.save(report);
        return toResponse(report, people);
    }

    /**
     * Grants an engineer's request to be put on a report.
     *
     * @param requestId the request
     * @param caller the faculty admin
     * @return the updated report
     * @throws NoSuchElementException if there is no such assignment request
     * @throws IllegalStateException if the request has already been decided
     */
    public ReportResponse approveAssignmentRequest(String requestId, Caller caller) {
        requireFacultyAdmin(caller, "approve requests");
        ReportRequest request = requirePending(requestId, RequestType.ASSIGNMENT);
        Set<String> engineers = new LinkedHashSet<>();
        assignments.findByReport(request.reportId()).forEach(grant -> engineers.add(grant.assigneeId()));
        engineers.add(request.requestedBy());
        return assignEngineers(request.reportId(), List.copyOf(engineers), caller);
    }

    /**
     * Refuses an engineer's request to be put on a report.
     *
     * @param requestId the request
     * @param caller the faculty admin
     * @return the declined request
     * @throws NoSuchElementException if there is no such assignment request
     * @throws IllegalStateException if the request has already been decided
     */
    public AssignmentRequestResponse declineAssignmentRequest(String requestId, Caller caller) {
        requireFacultyAdmin(caller, "decline requests");
        Snapshot people = directory.snapshot();
        ReportRequest request = requirePending(requestId, RequestType.ASSIGNMENT);
        requireVisible(require(request.reportId()), caller, people);
        ReportRequest declined = requests.save(
            request.resolve(RequestStatus.DECLINED, caller.employeeId()));
        record(request.reportId(), ActivityKind.REQUEST, caller,
            "Declined assignment request from " + name(request.requestedBy(), people));
        return AssignmentRequestResponse.from(
            declined, summary(request.requestedBy(), people), null);
    }

    /**
     * Confirms an author's request to close their report.
     *
     * The report is walked forward through the legal moves to ARCHIVED, each one recorded in the
     * thread, so the lifecycle rules hold even when a report is closed early. An UNASSIGNED report
     * cannot be closed this way: somebody has to be put on it first, or the request declined.
     *
     * @param requestId the request
     * @param caller the faculty admin
     * @return the archived report
     * @throws NoSuchElementException if there is no such close request
     * @throws IllegalStateException if the request has already been decided or the report is
     *     UNASSIGNED
     */
    public ReportResponse approveCloseRequest(String requestId, Caller caller) {
        requireFacultyAdmin(caller, "approve requests");
        Snapshot people = directory.snapshot();
        ReportRequest request = requirePending(requestId, RequestType.CLOSE);
        Report report = require(request.reportId());
        requireVisible(report, caller, people);
        if (report.getStatus() == ReportStatus.UNASSIGNED) {
            throw new IllegalStateException(
                "Assign an engineer before closing, or decline the request");
        }
        while (report.getStatus() != ReportStatus.ARCHIVED) {
            move(report, FORWARD.get(report.getStatus()), caller);
        }
        reports.save(report);
        requests.save(request.resolve(RequestStatus.APPROVED, caller.employeeId()));
        record(report.getReportId(), ActivityKind.REQUEST, caller, "Confirmed close request");
        return toResponse(report, people);
    }

    /**
     * Refuses an author's request to close their report.
     *
     * @param requestId the request
     * @param caller the faculty admin
     * @return the declined request
     * @throws NoSuchElementException if there is no such close request
     * @throws IllegalStateException if the request has already been decided
     */
    public CloseRequestResponse declineCloseRequest(String requestId, Caller caller) {
        requireFacultyAdmin(caller, "decline requests");
        Snapshot people = directory.snapshot();
        ReportRequest request = requirePending(requestId, RequestType.CLOSE);
        requireVisible(require(request.reportId()), caller, people);
        ReportRequest declined = requests.save(
            request.resolve(RequestStatus.DECLINED, caller.employeeId()));
        record(request.reportId(), ActivityKind.REQUEST, caller, "Declined close request");
        return CloseRequestResponse.from(declined, summary(request.requestedBy(), people), null);
    }

    // ---------------------------------------------------------------------------------------------
    // Visibility
    // ---------------------------------------------------------------------------------------------

    /**
     * Decides whether the caller may see a report, by the rules on the class.
     *
     * @param report the report
     * @param caller who is asking
     * @param people the directory as of this request
     * @return true when the caller may see it
     */
    private boolean visible(Report report, Caller caller, Snapshot people) {
        if (caller.employeeId().equals(report.getAuthorId())) {
            return true;
        }
        if (!caller.isFacultyAdmin() && !caller.isEngineer()) {
            return false;
        }
        if (people.onNoTeam(report.getAuthorId())) {
            return true;
        }
        List<ReportAssignment> grants = assignments.findByReport(report.getReportId());
        if (caller.isFacultyAdmin()) {
            return onTeam(report, grants, caller.employeeId(), people);
        }
        if (grants.stream().anyMatch(grant -> grant.assigneeId().equals(caller.employeeId()))) {
            return true;
        }
        return caller.facultyAdminId() != null
            && onTeam(report, grants, caller.facultyAdminId(), people);
    }

    /**
     * Reports whether a report belongs to a team: its author or any assignee is on it.
     *
     * @param report the report
     * @param grants the grants on it
     * @param teamId the team's faculty admin id
     * @param people the directory as of this request
     * @return true when the report is on that team
     */
    private static boolean onTeam(
        Report report,
        List<ReportAssignment> grants,
        String teamId,
        Snapshot people
    ) {
        if (people.teamOf(report.getAuthorId()).filter(teamId::equals).isPresent()) {
            return true;
        }
        return grants.stream()
            .anyMatch(grant -> people.teamOf(grant.assigneeId()).filter(teamId::equals).isPresent());
    }

    private void requireVisible(Report report, Caller caller, Snapshot people) {
        if (!visible(report, caller, people)) {
            throw new ForbiddenException("You do not have access to this report");
        }
    }

    private static void requireFacultyAdmin(Caller caller, String action) {
        if (!caller.isFacultyAdmin()) {
            throw new ForbiddenException("Only a faculty admin can " + action);
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------------------------

    private Report require(String reportId) {
        return reports.findById(reportId)
            .orElseThrow(() -> new NoSuchElementException("No report " + reportId));
    }

    /**
     * Looks up a request of the given kind that is still waiting on a decision.
     *
     * A request of the other kind is reported as missing rather than as the wrong kind, since the
     * two live under different URLs and a caller who mixed them up has named something that is not
     * there.
     */
    private ReportRequest requirePending(String requestId, RequestType type) {
        String label = type == RequestType.CLOSE ? "close" : "assignment";
        ReportRequest request = requests.findById(requestId)
            .filter(found -> found.type() == type)
            .orElseThrow(() -> new NoSuchElementException("No " + label + " request " + requestId));
        if (!request.isPending()) {
            throw new IllegalStateException("Request " + requestId + " is already " + request.status());
        }
        return request;
    }

    private Stream<ReportRequest> pending(String reportId, RequestType type) {
        return requests.findByReport(reportId).stream()
            .filter(ReportRequest::isPending)
            .filter(request -> request.type() == type);
    }

    /**
     * Applies one lifecycle move and records it in the thread.
     *
     * An illegal move is a conflict with the report's current state rather than a malformed request,
     * so the domain's IllegalArgumentException is translated into the exception the handler maps to
     * 409.
     */
    private void move(Report report, ReportStatus next, Caller actor) {
        ReportStatus from = report.getStatus();
        try {
            report.moveTo(next);
        } catch (IllegalArgumentException illegal) {
            throw new IllegalStateException(illegal.getMessage());
        }
        record(report.getReportId(), ActivityKind.STATUS, actor, from + " → " + next);
    }

    private ReportActivity record(String reportId, ActivityKind kind, Caller author, String body) {
        return activities.append(new ReportActivity(
            Ids.next("ACT"), reportId, kind, author.employeeId(), body, Instant.now()));
    }

    private ReportResponse toResponse(Report report, Snapshot people) {
        String reportId = report.getReportId();
        List<AssigneeResponse> assignees = assignments.findByReport(reportId).stream()
            .map(grant -> AssigneeResponse.from(grant, summary(grant.assigneeId(), people)))
            .toList();
        List<AssignmentRequestResponse> pendingAssignments = pending(reportId, RequestType.ASSIGNMENT)
            .map(request -> AssignmentRequestResponse.from(
                request, summary(request.requestedBy(), people), null))
            .toList();
        CloseRequestResponse pendingClose = pending(reportId, RequestType.CLOSE)
            .findFirst()
            .map(request -> CloseRequestResponse.from(
                request, summary(request.requestedBy(), people), null))
            .orElse(null);
        return ReportResponse.from(
            report, summary(report.getAuthorId(), people), assignees, pendingAssignments, pendingClose);
    }

    private static EmployeeSummary summary(String employeeId, Snapshot people) {
        if (employeeId == null) {
            return null;
        }
        return people.find(employeeId).map(EmployeeSummary::from)
            .orElse(EmployeeSummary.former(employeeId));
    }

    private static String name(String employeeId, Snapshot people) {
        return people.find(employeeId).map(employee -> employee.getEmail()).orElse(employeeId);
    }

    private static String names(Stream<String> employeeIds, Snapshot people) {
        return String.join(", ", employeeIds.map(id -> name(id, people)).toList());
    }

    private static void requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
    }
}
