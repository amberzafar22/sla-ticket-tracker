import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resolvers, addBusinessHours, SLA_HOURS_BY_PRIORITY, GraphQLContext } from "./resolvers";
import { prisma } from "./lib/prisma";

const runId = Date.now();
const createdUserIds: string[] = [];
const createdTicketIds: string[] = [];

function customerCtx(userId: string): GraphQLContext {
  return { userId, role: "USER" };
}
function agentCtx(userId: string): GraphQLContext {
  return { userId, role: "AGENT" };
}

afterAll(async () => {
  // Clean up everything this test run created, so repeat runs don't clutter the DB.
  await prisma.comment.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
  await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("addBusinessHours (pure logic, no DB)", () => {
  it("stays within the same business day", () => {
    // Monday 2026-08-31 10:00 + 2 business hours -> 12:00 same day
    const start = new Date(2026, 7, 31, 10, 0, 0);
    const result = addBusinessHours(start, 2);
    expect(result.getHours()).toBe(12);
    expect(result.getDate()).toBe(31);
  });

  it("rolls over to the next business day when the window is exceeded", () => {
    // Monday 16:00 + 2 hours: 1 hour left today (to 17:00), 1 hour rolls to Tuesday 09:00 -> 10:00
    const start = new Date(2026, 7, 31, 16, 0, 0);
    const result = addBusinessHours(start, 2);
    expect(result.getDate()).toBe(1); // Tuesday Sep 1
    expect(result.getHours()).toBe(10);
  });

  it("skips the weekend", () => {
    // Friday 2026-09-04 16:00 + 2 hours -> rolls past Sat/Sun to Monday 09:00 + 1h = 10:00
    const start = new Date(2026, 8, 4, 16, 0, 0);
    const result = addBusinessHours(start, 2);
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getHours()).toBe(10);
  });
});

describe("signup and login", () => {
  const email = `test-${runId}-signup@example.com`;
  const password = "password123";

  it("signs up a new user and returns a valid token", async () => {
    const result = await resolvers.Mutation.signup(null, {
      email,
      password,
      name: "Test User",
    });
    createdUserIds.push(result.user.id);

    expect(result.token).toBeTypeOf("string");
    expect(result.user.email).toBe(email);
    expect(result.user.role).toBe("USER");
  });

  it("rejects signup with a duplicate email", async () => {
    await expect(
      resolvers.Mutation.signup(null, { email, password, name: "Dup" })
    ).rejects.toThrow(/already exists/i);
  });

  it("logs in with the correct password", async () => {
    const result = await resolvers.Mutation.login(null, { email, password });
    expect(result.token).toBeTypeOf("string");
  });

  it("rejects login with the wrong password", async () => {
    await expect(
      resolvers.Mutation.login(null, { email, password: "wrongpassword" })
    ).rejects.toThrow(/invalid email or password/i);
  });
});

describe("ticket creation and SLA deadline", () => {
  let customerId: string;

  beforeAll(async () => {
    const signup = await resolvers.Mutation.signup(null, {
      email: `test-${runId}-customer@example.com`,
      password: "password123",
      name: "Customer",
    });
    customerId = signup.user.id;
    createdUserIds.push(customerId);
  });

  it("creates a ticket with a computed slaDeadline matching its priority's SLA window", async () => {
    const before = new Date();
    const ticket = await resolvers.Mutation.createTicket(
      null,
      { title: "Test ticket", description: "Something broke", priority: "HIGH" },
      customerCtx(customerId)
    );
    createdTicketIds.push(ticket.id);

    expect(ticket.status).toBe("OPEN");
    expect(ticket.slaDeadline).not.toBeNull();

    const expectedDeadline = addBusinessHours(before, SLA_HOURS_BY_PRIORITY.HIGH);
    // Allow a small tolerance for the time elapsed during the test itself.
    const diffMs = Math.abs(ticket.slaDeadline!.getTime() - expectedDeadline.getTime());
    expect(diffMs).toBeLessThan(5000);
  });

  it("rejects ticket creation without authentication", async () => {
    await expect(
      resolvers.Mutation.createTicket(
        null,
        { title: "No auth", description: "Should fail", priority: "LOW" },
        { userId: null, role: null }
      )
    ).rejects.toThrow(/not authenticated/i);
  });
});

describe("agent-only permissions", () => {
  let customerId: string;
  let agentId: string;
  let ticketId: string;

  beforeAll(async () => {
    const customer = await resolvers.Mutation.signup(null, {
      email: `test-${runId}-perm-customer@example.com`,
      password: "password123",
      name: "Perm Customer",
    });
    customerId = customer.user.id;
    createdUserIds.push(customerId);

    const agentSignup = await resolvers.Mutation.signup(null, {
      email: `test-${runId}-perm-agent@example.com`,
      password: "password123",
      name: "Perm Agent",
    });
    agentId = agentSignup.user.id;
    createdUserIds.push(agentId);
    // Promote to AGENT directly via Prisma (mirrors how it's done in Prisma Studio)
    await prisma.user.update({ where: { id: agentId }, data: { role: "AGENT" } });

    const ticket = await resolvers.Mutation.createTicket(
      null,
      { title: "Perm test ticket", description: "desc", priority: "MEDIUM" },
      customerCtx(customerId)
    );
    ticketId = ticket.id;
    createdTicketIds.push(ticketId);
  });

  it("rejects assignTicket from a non-agent USER", async () => {
    await expect(
      resolvers.Mutation.assignTicket(
        null,
        { ticketId, agentId },
        customerCtx(customerId)
      )
    ).rejects.toThrow(/only agents/i);
  });

  it("allows assignTicket from an AGENT", async () => {
    const updated = await resolvers.Mutation.assignTicket(
      null,
      { ticketId, agentId },
      agentCtx(agentId)
    );
    expect(updated.assignee?.id).toBe(agentId);
  });

  it("rejects updateTicketStatus from a non-agent USER", async () => {
    await expect(
      resolvers.Mutation.updateTicketStatus(
        null,
        { ticketId, status: "RESOLVED" },
        customerCtx(customerId)
      )
    ).rejects.toThrow(/only agents/i);
  });
});

describe("first-response tracking", () => {
  let customerId: string;
  let agentId: string;
  let ticketId: string;

  beforeAll(async () => {
    const customer = await resolvers.Mutation.signup(null, {
      email: `test-${runId}-fr-customer@example.com`,
      password: "password123",
      name: "FR Customer",
    });
    customerId = customer.user.id;
    createdUserIds.push(customerId);

    const agentSignup = await resolvers.Mutation.signup(null, {
      email: `test-${runId}-fr-agent@example.com`,
      password: "password123",
      name: "FR Agent",
    });
    agentId = agentSignup.user.id;
    createdUserIds.push(agentId);
    await prisma.user.update({ where: { id: agentId }, data: { role: "AGENT" } });

    const ticket = await resolvers.Mutation.createTicket(
      null,
      { title: "FR ticket", description: "desc", priority: "LOW" },
      customerCtx(customerId)
    );
    ticketId = ticket.id;
    createdTicketIds.push(ticketId);
  });

  it("does not set firstResponseAt when the customer comments on their own ticket", async () => {
    await resolvers.Mutation.addComment(
      null,
      { ticketId, content: "Any update?" },
      customerCtx(customerId)
    );
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    expect(ticket?.firstResponseAt).toBeNull();
  });

  it("sets firstResponseAt the first time an agent comments", async () => {
    await resolvers.Mutation.addComment(
      null,
      { ticketId, content: "Looking into it." },
      agentCtx(agentId)
    );
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    expect(ticket?.firstResponseAt).not.toBeNull();
  });
});