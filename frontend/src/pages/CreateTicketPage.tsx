import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createTicket, type Priority } from "../api/tickets";

export default function CreateTicketPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const ticket = await createTicket(title, description, priority);
      navigate(`/tickets/${ticket.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ticket.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <Link to="/tickets">&larr; Back to tickets</Link>
      <form className="ticket-form" onSubmit={handleSubmit}>
        <h1>New Ticket</h1>
        {error && <p className="error">{error}</p>}
        <label>
          Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <label>
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={5}
          />
        </label>
        <label>
          Priority
          <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Ticket"}
        </button>
      </form>
    </div>
  );
}
