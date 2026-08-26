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

    createTicket: (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
      requireAuth(ctx);
      throw new Error("Not implemented yet");
    },
    assignTicket: (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
      requireAuth(ctx);
      throw new Error("Not implemented yet");
    },
    updateTicketStatus: (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
      requireAuth(ctx);
      throw new Error("Not implemented yet");
    },
    addComment: (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
      requireAuth(ctx);
      throw new Error("Not implemented yet");
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
