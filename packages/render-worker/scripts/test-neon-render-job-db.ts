// Verifies render-job.ts's ported DB layer (claimJob/updateJob/loadJob/
// releaseLease/touchLease) against a real Neon database - not a mock. Sets
// up one throwaway workspace/project/revision/render_jobs row under the
// existing seed workspace/user (see apps/api's SEED_WORKSPACE_ID/
// SEED_USER_ID), exercises every function, then deletes everything it made.
//
// Usage: DATABASE_URL=... SEED_WORKSPACE_ID=... SEED_USER_ID=... pnpm exec tsx scripts/test-neon-render-job-db.ts
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { claimJob, createDatabase, loadJob, releaseLease, touchLease, updateJob } from "../src/render-job";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function main() {
  const workspaceId = requiredEnv("SEED_WORKSPACE_ID");
  const userId = requiredEnv("SEED_USER_ID");
  const db = createDatabase();

  const projectId = randomUUID();
  const revisionId = randomUUID();
  const publicRef = `rnd_test_${randomUUID().slice(0, 8)}`;

  try {
    await db.query(
      `insert into projects (id, workspace_id, created_by) values ($1, $2, $3)`,
      [projectId, workspaceId, userId],
    );
    await db.query(
      `insert into project_revisions (id, project_id, revision_no, document_json, content_hash, created_by)
       values ($1, $2, 1, '{}'::jsonb, 'test-hash', $3)`,
      [revisionId, projectId, userId],
    );
    await db.query(
      `insert into render_jobs (public_ref, workspace_id, project_id, revision_id, created_by, idempotency_key, runtime_json)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [publicRef, workspaceId, projectId, revisionId, userId, `idem-${publicRef}`, JSON.stringify({ test: true })],
    );
    console.log("[test] inserted render_jobs row", publicRef);

    const loaded = await loadJob(db, publicRef);
    assert.ok(loaded, "loadJob should find the row");
    assert.equal(loaded.status, "queued");
    console.log("[test] loadJob: ok (status=queued)");

    const claimed = await claimJob(db, publicRef, "test-worker-1");
    assert.ok(claimed, "claimJob should succeed on a queued job");
    assert.equal(claimed.status, "planning");
    console.log("[test] claimJob: ok (status now planning, lease held by test-worker-1)");

    const stolenClaim = await claimJob(db, publicRef, "test-worker-2");
    assert.equal(stolenClaim, null, "a second worker must not be able to claim a fresh lease");
    console.log("[test] claimJob CAS: ok (second worker correctly rejected while lease is fresh)");

    await touchLease(db, publicRef, "test-worker-1");
    const afterTouch = await loadJob(db, publicRef);
    assert.ok(afterTouch, "job should still exist after touchLease");
    console.log("[test] touchLease: ok");

    await updateJob(db, publicRef, "test-worker-1", {
      status: "rendering",
      stage: "rendering",
      progress: 0.5,
      metrics_json: { renderMilliseconds: 1234, framesRendered: 42 },
    });
    const afterUpdate = await db.query("select status, stage, progress, metrics_json from render_jobs where public_ref = $1", [publicRef]);
    assert.equal(afterUpdate.rows[0].status, "rendering");
    assert.equal(afterUpdate.rows[0].metrics_json.framesRendered, 42);
    console.log("[test] updateJob (with jsonb column): ok, metrics_json round-tripped correctly");

    let rejected = false;
    try {
      await updateJob(db, publicRef, "test-worker-WRONG", { progress: 0.9 });
    } catch {
      rejected = true;
    }
    assert.ok(rejected, "updateJob must reject a write from a worker that doesn't hold the lease");
    console.log("[test] updateJob lease guard: ok (wrong worker correctly rejected)");

    await releaseLease(db, publicRef, "test-worker-1", "done");
    const final = await loadJob(db, publicRef);
    assert.equal(final?.status, "done");
    console.log("[test] releaseLease: ok (status=done)");

    console.log("[test] ALL CHECKS PASSED");
  } finally {
    await db.query("delete from render_jobs where public_ref = $1", [publicRef]);
    await db.query("delete from project_revisions where id = $1", [revisionId]);
    await db.query("delete from projects where id = $1", [projectId]);
    await db.end();
    console.log("[test] cleaned up test rows");
  }
}

void main();
