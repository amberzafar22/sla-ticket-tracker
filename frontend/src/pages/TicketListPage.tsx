import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchTickets, type Ticket, type Priority, type Status } from "../api/tickets";
import SlaBadge from "../components/SlaBadge";
import { useAuth } from "../context/AuthContext";

const PAGE_SIZE = 10;

export default function TicketListPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<Status | "">("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { logout } = useAuth();

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchTickets({
      status: statusFilter || undefined,
      priority: priorityFilter || undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((data) => {
        setTickets(data.tickets);
        setTotalCount(data.totalCount);
        setHasNextPage(data.hasNextPage);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load tickets."))
      .finally(() => setLoading(false));
  }, [page, statusFilter, priorityFilter]);

  return (
    <div className="page">
      <header className="page-header">
        <h1>Tickets</h1>
        <div>
          <Link to="/tickets/new">+ New Ticket</Link>
          <button onClick={logout} style={{ marginLeft: "1rem" }}>
            Log out
          </button>
        </div>
      </header>

      <div className="filters">
        <label>
          Status:
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as Status | "");
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </label>
        <label>
          Priority:
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value as Priority | "");
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </label>
      </div>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : tickets.length === 0 ? (
        <p>No tickets found.</p>
      ) : (
        <table className="ticket-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Priority</th>
              <th>Status</th>
              <th>SLA</th>
              <th>Assignee</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link to={`/tickets/${t.id}`}>{t.title}</Link>
                </td>
                <td>{t.priority}</td>
                <td>{t.status}</td>
                <td>
                  <SlaBadge state={t.slaState} />
                </td>
                <td>{t.assignee ? t.assignee.name : "Unassigned"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="pagination">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <span>
          Page {page} ({totalCount} total)
        </span>
        <button disabled={!hasNextPage} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
