import { useEffect, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import {
  fetchTicket,
  addComment,
  updateTicketStatus,
  assignTicket,
  type Ticket,
  type Status,
} from "../api/tickets";
import SlaBadge from "../components/SlaBadge";
import { useAuth } from "../context/AuthContext";

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [agentIdInput, setAgentIdInput] = useState("");
  const { user } = useAuth();

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTicket(id);
      setTicket(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ticket.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!id || !commentText.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await addComment(id, commentText);
      setCommentText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add comment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(status: Status) {
    if (!id) return;
    setError(null);
    try {
      await updateTicketStatus(id, status);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status.");
    }
  }

  async function handleAssign(e: FormEvent) {
    e.preventDefault();
    if (!id || !agentIdInput.trim()) return;
    setError(null);
    try {
      await assignTicket(id, agentIdInput.trim());
      setAgentIdInput("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign ticket.");
    }
  }

  if (loading) return <div className="page">Loading...</div>;
  if (error && !ticket) return <div className="page"><p className="error">{error}</p></div>;
  if (!ticket) return <div className="page">Ticket not found.</div>;

  const isAgent = user?.role === "AGENT";

  return (
    <div className="page">
      <Link to="/tickets">&larr; Back to tickets</Link>
      <h1>{ticket.title}</h1>
      {error && <p className="error">{error}</p>}

      <div className="ticket-meta">
        <span>Priority: {ticket.priority}</span>
        <span>Status: {ticket.status}</span>
        <SlaBadge state={ticket.slaState} />
        <span>Created by: {ticket.creator.name}</span>
        <span>Assignee: {ticket.assignee ? ticket.assignee.name : "Unassigned"}</span>
        {ticket.firstResponseAt && (
          <span>First response: {new Date(ticket.firstResponseAt).toLocaleString()}</span>
        )}
        {ticket.slaDeadline && (
          <span>SLA deadline: {new Date(ticket.slaDeadline).toLocaleString()}</span>
        )}
      </div>

      <p className="ticket-description">{ticket.description}</p>

      {isAgent && (
        <div className="agent-controls">
          <h3>Agent Controls</h3>
          <div>
            <label>
              Change status:
              <select
                value={ticket.status}
                onChange={(e) => handleStatusChange(e.target.value as Status)}
              >
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </label>
          </div>
          <form onSubmit={handleAssign}>
            <label>
              Assign to agent (paste agent user ID):
              <input
                type="text"
                value={agentIdInput}
                onChange={(e) => setAgentIdInput(e.target.value)}
                placeholder="agent user id"
              />
            </label>
            <button type="submit">Assign</button>
          </form>
        </div>
      )}

      <h2>Comments</h2>
      <ul className="comment-list">
        {(ticket.comments ?? []).map((c) => (
          <li key={c.id}>
            <strong>
              {c.author.name} ({c.author.role})
            </strong>{" "}
            <span className="comment-date">{new Date(c.createdAt).toLocaleString()}</span>
            <p>{c.content}</p>
          </li>
        ))}
      </ul>

      <form className="comment-form" onSubmit={handleAddComment}>
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Add a comment..."
          rows={3}
          required
        />
        <button type="submit" disabled={submitting}>
          {submitting ? "Posting..." : "Post Comment"}
        </button>
      </form>
    </div>
  );
}
