import { createServer } from "node:http";
import { createYoga, createSchema } from "graphql-yoga";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const typeDefs = readFileSync(
  join(__dirname, "schema", "schema.graphql"),
  "utf-8"
);

const resolvers = {
  Query: {
    me: () => null,
    ticket: () => null,
    tickets: () => ({ tickets: [], totalCount: 0, hasNextPage: false }),
  },
  Mutation: {
    signup: () => {
      throw new Error("Not implemented yet");
    },
    login: () => {
      throw new Error("Not implemented yet");
    },
    createTicket: () => {
      throw new Error("Not implemented yet");
    },
    assignTicket: () => {
      throw new Error("Not implemented yet");
    },
    updateTicketStatus: () => {
      throw new Error("Not implemented yet");
    },
    addComment: () => {
      throw new Error("Not implemented yet");
    },
  },
};

const schema = createSchema({
  typeDefs,
  resolvers,
});

const yoga = createYoga({ schema });
const server = createServer(yoga);

server.listen(4000, () => {
  console.log("Server running at http://localhost:4000/graphql");
});
