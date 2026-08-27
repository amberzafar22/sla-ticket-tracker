import "dotenv/config";
import { createServer } from "node:http";
import { createYoga, createSchema } from "graphql-yoga";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { verifyToken } from "./lib/auth";
import { resolvers, GraphQLContext } from "./resolvers";

const typeDefs = readFileSync(
  join(__dirname, "schema", "schema.graphql"),
  "utf-8"
);

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