import { GraphQLClient } from "graphql-request";

const ENDPOINT = "http://localhost:4000/graphql";

export function getClient(): GraphQLClient {
  const token = localStorage.getItem("token");
  return new GraphQLClient(ENDPOINT, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}
