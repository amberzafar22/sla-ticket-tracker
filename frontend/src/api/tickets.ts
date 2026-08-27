import { gql } from "graphql-request";
import { getClient } from "./client";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type Status = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type SlaState = "ON_TRACK" | "AT_RISK" | "BREACHED";

export interface TicketUser {
  id: string;
  name: string;
  email: string;
  role: "USER" | "AGENT";
}

export interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: TicketUser;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: Status;
  creator: TicketUser;
  assignee: TicketUser | null;
  createdAt: string;
  updatedAt: string;
  firstResponseAt: string | null;
  slaDeadline: string | null;
  resolvedAt: string | null;
  slaState: SlaState;
  comments: Comment[];
}

export interface TicketConnection {
  tickets: Ticket[];
  totalCount: number;
  hasNextPage: boolean;
}

const TICKET_FIELDS = gql`
  fragment TicketFields on Ticket {
    id
    title
    description
    priority
    status
    createdAt
    updatedAt
    firstResponseAt
    slaDeadline
    resolvedAt
    slaState
    creator {
      id
      name
      email
      role
    }
    assignee {
      id
      name
      email
      role
    }
  }
`;

const TICKETS_QUERY = gql`
  ${TICKET_FIELDS}
  query Tickets($status: Status, $priority: Priority, $page: Int, $pageSize: Int) {
    tickets(status: $status, priority: $priority, page: $page, pageSize: $pageSize) {
      totalCount
      hasNextPage
      tickets {
        ...TicketFields
      }
    }
  }
`;

const TICKET_QUERY = gql`
  ${TICKET_FIELDS}
  query TicketDetail($id: ID!) {
    ticket(id: $id) {
      ...TicketFields
      comments {
        id
        content
        createdAt
        author {
          id
          name
          role
        }
      }
    }
  }
`;

const CREATE_TICKET = gql`
  ${TICKET_FIELDS}
  mutation CreateTicket($title: String!, $description: String!, $priority: Priority!) {
    createTicket(title: $title, description: $description, priority: $priority) {
      ...TicketFields
    }
  }
`;

const ASSIGN_TICKET = gql`
  ${TICKET_FIELDS}
  mutation AssignTicket($ticketId: ID!, $agentId: ID!) {
    assignTicket(ticketId: $ticketId, agentId: $agentId) {
      ...TicketFields
    }
  }
`;

const UPDATE_STATUS = gql`
  ${TICKET_FIELDS}
  mutation UpdateStatus($ticketId: ID!, $status: Status!) {
    updateTicketStatus(ticketId: $ticketId, status: $status) {
      ...TicketFields
    }
  }
`;

const ADD_COMMENT = gql`
  mutation AddComment($ticketId: ID!, $content: String!) {
    addComment(ticketId: $ticketId, content: $content) {
      id
      content
      createdAt
      author {
        id
        name
        role
      }
    }
  }
`;

export async function fetchTickets(params: {
  status?: Status;
  priority?: Priority;
  page?: number;
  pageSize?: number;
}): Promise<TicketConnection> {
  const data = await getClient().request<{ tickets: TicketConnection }>(TICKETS_QUERY, params);
  return data.tickets;
}

export async function fetchTicket(id: string): Promise<Ticket> {
  const data = await getClient().request<{ ticket: Ticket }>(TICKET_QUERY, { id });
  return data.ticket;
}

export async function createTicket(
  title: string,
  description: string,
  priority: Priority
): Promise<Ticket> {
  const data = await getClient().request<{ createTicket: Ticket }>(CREATE_TICKET, {
    title,
    description,
    priority,
  });
  return data.createTicket;
}

export async function assignTicket(ticketId: string, agentId: string): Promise<Ticket> {
  const data = await getClient().request<{ assignTicket: Ticket }>(ASSIGN_TICKET, {
    ticketId,
    agentId,
  });
  return data.assignTicket;
}

export async function updateTicketStatus(ticketId: string, status: Status): Promise<Ticket> {
  const data = await getClient().request<{ updateTicketStatus: Ticket }>(UPDATE_STATUS, {
    ticketId,
    status,
  });
  return data.updateTicketStatus;
}

export async function addComment(ticketId: string, content: string): Promise<Comment> {
  const data = await getClient().request<{ addComment: Comment }>(ADD_COMMENT, {
    ticketId,
    content,
  });
  return data.addComment;
}
