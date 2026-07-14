// Runnable check for the session-token scheme: node auth.test.mjs
import assert from "node:assert";
import { makeToken, validToken } from "./[[path]].js";

const secret = "test-secret-please-change";
const token = await makeToken(secret);

assert(await validToken(secret, token), "fresh token must validate");
assert(!(await validToken("wrong-secret", token)), "wrong secret must fail");
assert(!(await validToken(secret, token.slice(0, -2) + "xx")), "tampered signature must fail");
assert(!(await validToken(secret, "9999999999.deadbeef")), "forged signature must fail");
assert(!(await validToken(secret, "0.anything")), "expired token must fail");
assert(!(await validToken(secret, "")), "empty token must fail");

console.log("ok: auth token scheme");
