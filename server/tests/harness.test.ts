import type { Server } from "node:http";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

// Guards tests/setup.ts: if a supertest upgrade bypassed the patch, the 127.0.0.1 port clash would come back silently.
describe("Test harness", () => {
  it("serves Supertest requests from a server listening on 127.0.0.1", async () => {
    const test = request(app).get("/api/health");
    let host: string | undefined;
    (test as unknown as { app: Server }).app.once("listening", function (this: Server) {
      host = (this.address() as { address: string }).address;
    });
    expect((await test).status).toBe(200);
    expect(host).toBe("127.0.0.1");
  });
});
