import type { Server } from "node:http";
import { createRequire } from "node:module";

// supertest starts the app with app.listen(0), which listens on every interface (::), then
// calls http://127.0.0.1:<port>. macOS can hand out a port that another local program already
// holds on 127.0.0.1 only; that program then answers instead of the app (random 404/401s and
// stalled requests in parallel runs). Listening on 127.0.0.1 itself makes the OS pick a port
// that is free there. That listen is asynchronous, so the URL is filled in when the request ends.
type PatchedTest = { app: Server; url: string; _server?: Server; _path: string };
type End = (this: PatchedTest, fn?: (error: unknown, res?: unknown) => void) => unknown;
const { Test } = createRequire(import.meta.url)("supertest") as {
  Test: { prototype: { serverAddress(app: Server, path: string): string; end: End } };
};
const originalEnd = Test.prototype.end;

Test.prototype.serverAddress = function serverAddress(this: PatchedTest, app: Server, path: string) {
  if (!app.address()) this._server = app.listen(0, "127.0.0.1");
  this._path = path;
  return `http://127.0.0.1${path}`; // replaced in end() once the port is known
};

Test.prototype.end = function end(this: PatchedTest, fn) {
  const send = () => {
    const address = this.app.address();
    if (!address || typeof address === "string") return fn?.(new Error("Test server has no TCP address"));
    this.url = `http://127.0.0.1:${address.port}${this._path}`;
    return originalEnd.call(this, fn);
  };
  if (this.app.address()) return send();
  this.app.once("listening", send).once("error", (error) => fn?.(error));
  return this;
};
