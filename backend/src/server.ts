import { createServer } from "node:http";
import { createYoga, createSchema } from "graphql-yoga";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "./lib/prisma";
import { hashPassword, verifyPassword, signToken, verifyToken } from "./lib/auth";

const typeDefs = readFileSync(
  join(__dirname, "schema", "schema.graphql"),
  "utf-8"
);

interface GraphQLContext {
  userId: string | null;
  role: "USER" | "AGENT" | null;
}

interface SignupArgs {
  email: string;
  password: string;
  name: string;
}

interface LoginArgs {
  email: string;
  password: string;
}

interface CreateTicketArgs {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}

interface AssignTicketArgs {
  ticketId: string;
  agentId: string;
}

interface UpdateTicketStatusArgs {
  ticketId: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
}

interface AddCommentArgs {
  ticketId: string;
  content: string;
}

function requireAuth(ctx: GraphQLContext): { userId: string; role: "USER" | "AGENT" } {
  if (!ctx.userId || !ctx.role) {
    throw new Error("Not authenticated. Please log in.");
  }
  return { userId: ctx.userId, role: ctx.role };
}

const resolvers = {
  Query: {
    me: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
      if (!ctx.userId) return null;
      return prisma.user.findUnique({ where: { id: ctx.userId } });
    },
    ticket: () => null,
    tickets: () => ({ tickets: [], totalCount: 0, hasNextPage: false }),
  },
  Mutation: {
    signup: async (_parent: unknown, args: SignupArgs) => {
      const { email, password, name } = args;

      if (!email || !email.includes("@")) {
        throw new Error("A valid email is required.");
      }
      if (!password || password.length < 8) {
        throw new Error("Password must be at least 8 characters long.");
      }
      if (!name || name.trim().length === 0) {
        throw new Error("Name is required.");
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new Error("An account with this email already exists.");
      }

      const hashed = await hashPassword(password);
      const user = await prisma.user.create({
        data: { email, password: hashed, name },
      });

      const token = signToken({ userId: user.id, role: user.role });
      return { token, user };
    },

    login: async (_parent: unknown, args: LoginArgs) => {
      const { email, password } = args;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new Error("Invalid email or password.");
      }

      const valid = await verifyPassword(password, user.password);
      if (!valid) {
        throw new Error("Invalid email or password.");
      }

      const token = signToken({ userId: user.id, role: user.role });
      return { token, user };
    },
        createTicket: async (
      _parent: unknown,
      args: CreateTicketArgs,
      ctx: GraphQLContext
    ) => {
      const { userId } = requireAuth(ctx);

      if (!args.title || args.title.trim().length === 0) {
        throw new Error("Title is required.");
      }
      if (!args.description || args.description.trim().length === 0) {
        throw new Error("Description is required.");
      }

      const ticket = await prisma.ticket.create({
        data: {
          title: args.title.trim(),
          description: args.description.trim(),
          priority: args.priority,
          status: "OPEN",
          creator: { connect: { id: userId } },
        },
        include: {
          creator: true,
          assignee: true,
          comments: { include: { author: true } },
        },
      });

      return ticket;
    },

    assignTicket: async (
      _parent: unknown,
      args: AssignTicketArgs,
      ctx: GraphQLContext
    ) => {
      const { role } = requireAuth(ctx);

      if (role !== "AGENT") {
        throw new Error("Only agents can assign tickets.");
      }

      const ticket = await prisma.ticket.findUnique({ where: { id: args.ticketId } });
      if (!ticket) {
        throw new Error("Ticket not found.");
      }

      const agent = await prisma.user.findUnique({ where: { id: args.agentId } });
      if (!agent || agent.role !== "AGENT") {
        throw new Error("Assignee must be a valid agent.");
      }

      const updated = await prisma.ticket.update({
        where: { id: args.ticketId },
        data: { assignee: { connect: { id: agent.id } } },
        include: {
          creator: true,
          assignee: true,
          comments: { include: { author: true } },
        },
      });

      return updated;
    },

    updateTicketStatus: async (
      _parent: unknown,
      args: UpdateTicketStatusArgs,
      ctx: GraphQLContext
    ) => {
      const { role } = requireAuth(ctx);

      if (role !== "AGENT") {
        throw new Error("Only agents can update ticket status.");
      }

      const ticket = await prisma.ticket.findUnique({ where: { id: args.ticketId } });
      if (!ticket) {
        throw new Error("Ticket not found.");
      }

      const updated = await prisma.ticket.update({
        where: { id: args.ticketId },
        data: {
          status: args.status,
          resolvedAt: args.status === "RESOLVED" ? new Date() : null,
        },
        include: {
          creator: true,
          assignee: true,
          comments: { include: { author: true } },
        },
      });

      return updated;
    },

    addComment: async (
      _parent: unknown,
      args: AddCommentArgs,
      ctx: GraphQLContext
    ) => {
      const { userId, role } = requireAuth(ctx);

      if (!args.content || args.content.trim().length === 0) {
        throw new Error("Comment content is required.");
      }

      const ticket = await prisma.ticket.findUnique({ where: { id: args.ticketId } });
      if (!ticket) {
        throw new Error("Ticket not found.");
      }

      const comment = await prisma.comment.create({
        data: {
          content: args.content.trim(),
          ticket: { connect: { id: args.ticketId } },
          author: { connect: { id: userId } },
        },
        include: { author: true },
      });

      if (role === "AGENT" && !ticket.firstResponseAt) {
        await prisma.ticket.update({
          where: { id: args.ticketId },
          data: { firstResponseAt: new Date() },
        });
      }

      return comment;
    },
  },

  Ticket: {
    slaState: (parent: { slaDeadline: Date | null; status: string }) => {
      // Placeholder until Milestone 6 implements real business-hours SLA logic
      if (parent.status === "RESOLVED" || parent.status === "CLOSED") return "ON_TRACK";
      if (!parent.slaDeadline) return "ON_TRACK";
      return new Date() > parent.slaDeadline ? "BREACHED" : "ON_TRACK";
    },
  },
};

const schema = createSchema({
  typeDefs,
  resolvers,
});

const yoga = createYoga({
  schema,
  context: async ({ request }): Promise<GraphQLContext> => {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { userId: null, role: null };
    }
    const token = authHeader.replace("Bearer ", "");
    const payload = verifyToken(token);
    if (!payload) {
      return { userId: null, role: null };
    }
    return { userId: payload.userId, role: payload.role };
  },
});

const server = createServer(yoga);

server.listen(4000, () => {
  console.log("Server running at http://localhost:4000/graphql");
});