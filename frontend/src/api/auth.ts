import { gql } from "graphql-request";
import { getClient } from "./client";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "USER" | "AGENT";
}

export interface AuthPayload {
  token: string;
  user: AuthUser;
}

const SIGNUP = gql`
  mutation Signup($email: String!, $password: String!, $name: String!) {
    signup(email: $email, password: $password, name: $name) {
      token
      user {
        id
        email
        name
        role
      }
    }
  }
`;

const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user {
        id
        email
        name
        role
      }
    }
  }
`;

const ME = gql`
  query Me {
    me {
      id
      email
      name
      role
    }
  }
`;

export async function signup(email: string, password: string, name: string): Promise<AuthPayload> {
  const data = await getClient().request<{ signup: AuthPayload }>(SIGNUP, {
    email,
    password,
    name,
  });
  return data.signup;
}

export async function login(email: string, password: string): Promise<AuthPayload> {
  const data = await getClient().request<{ login: AuthPayload }>(LOGIN, {
    email,
    password,
  });
  return data.login;
}

export async function fetchMe(): Promise<AuthUser | null> {
  const data = await getClient().request<{ me: AuthUser | null }>(ME);
  return data.me;
}
