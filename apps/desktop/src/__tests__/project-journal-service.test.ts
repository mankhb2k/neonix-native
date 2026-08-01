import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildBlankDesktopProject } from "../shared/project-file/envelope";
import {
  createDisabledProjectJournal,
  createProjectJournalService,
  hashDocumentJson,
  journalKeyFor,
} from "../main/services/project-journal-service";

describe("project-journal-service", () => {
  it("disabled journal is a no-op", async () => {
    const journal = createDisabledProjectJournal();
    expect(journal.enabled).toBe(false);
    await journal.recordHistory({
      projectId: "p1",
      entryId: "e1",
      label: "edit",
      documentJsonHash: hashDocumentJson("{}"),
    });
    expect(journal.peekRecovery({ projectId: "p1", documentJson: "{}" })).toBe(
      null,
    );
  });

  it("appends history entries and marks dirty", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-journal-"));
    const journal = createProjectJournalService({ userDataPath: dir });
    const blank = buildBlankDesktopProject({ name: "J1" });
    const filePath = path.join(dir, "demo.mt");
    fs.writeFileSync(filePath, blank.documentJson);

    await journal.bind({
      projectId: blank.projectId,
      path: filePath,
      documentJson: blank.documentJson,
    });

    const next = buildBlankDesktopProject({ name: "J1-edit" }).documentJson;
    const result = await journal.recordHistory({
      projectId: blank.projectId,
      path: filePath,
      entryId: "h1",
      label: "Rename",
      documentJsonHash: hashDocumentJson(next),
    });
    await journal.flush();

    expect(result.seq).toBe(1);
    const st = journal.status({ path: filePath });
    expect(st.dirty).toBe(true);
    expect(st.lastSeq).toBe(1);
    expect(st.journalDocumentHash).toBe(hashDocumentJson(next));
  });

  it("rotates autosave snapshots and supports recover vs discard", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-journal-"));
    const journal = createProjectJournalService({
      userDataPath: dir,
      maxSnapshots: 2,
    });
    const blank = buildBlankDesktopProject({ name: "Disk" });
    const filePath = path.join(dir, "proj.mt");
    fs.writeFileSync(filePath, blank.documentJson);
    await journal.bind({
      projectId: blank.projectId,
      path: filePath,
      documentJson: blank.documentJson,
    });

    const v1 = buildBlankDesktopProject({ name: "Snap1" }).documentJson;
    const v2 = buildBlankDesktopProject({ name: "Snap2" }).documentJson;
    const v3 = buildBlankDesktopProject({ name: "Snap3" }).documentJson;
    await journal.writeAutosaveSnapshot({
      projectId: blank.projectId,
      path: filePath,
      documentJson: v1,
    });
    await journal.writeAutosaveSnapshot({
      projectId: blank.projectId,
      path: filePath,
      documentJson: v2,
    });
    await journal.writeAutosaveSnapshot({
      projectId: blank.projectId,
      path: filePath,
      documentJson: v3,
    });
    await journal.flush();

    const offer = journal.peekRecovery({
      path: filePath,
      documentJson: blank.documentJson,
    });
    expect(offer).not.toBeNull();
    expect(offer?.journalDocumentHash).toBe(hashDocumentJson(v3));

    const recovered = await journal.recover({ path: filePath });
    expect(recovered?.documentJson).toBe(v3);

    await journal.discard({ path: filePath, projectId: blank.projectId });
    expect(
      journal.peekRecovery({
        path: filePath,
        documentJson: blank.documentJson,
      }),
    ).toBeNull();
  });

  it("clears journal on successful save lifecycle record", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-journal-"));
    const journal = createProjectJournalService({ userDataPath: dir });
    const blank = buildBlankDesktopProject({ name: "Save" });
    const filePath = path.join(dir, "save.mt");
    fs.writeFileSync(filePath, blank.documentJson);
    await journal.bind({
      projectId: blank.projectId,
      path: filePath,
      documentJson: blank.documentJson,
    });
    const dirty = buildBlankDesktopProject({ name: "Dirty" }).documentJson;
    await journal.writeAutosaveSnapshot({
      projectId: blank.projectId,
      path: filePath,
      documentJson: dirty,
    });
    await journal.flush();
    expect(
      journal.status({ path: filePath }).hasRecoverableSnapshot,
    ).toBe(true);

    await journal.record({
      type: "save",
      path: filePath,
      projectId: blank.projectId,
      at: new Date().toISOString(),
    });
    expect(journal.status({ path: filePath }).dirty).toBe(false);
    expect(
      journal.peekRecovery({
        path: filePath,
        documentJson: blank.documentJson,
      }),
    ).toBeNull();
  });

  it("Save As clears both projectId and path journals (no ghost recovery)", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-journal-"));
    const journal = createProjectJournalService({ userDataPath: dir });
    const blank = buildBlankDesktopProject({ name: "Unsaved" });
    await journal.bind({ projectId: blank.projectId });
    const dirty = buildBlankDesktopProject({ name: "DirtyUnsaved" }).documentJson;
    await journal.writeAutosaveSnapshot({
      projectId: blank.projectId,
      documentJson: dirty,
    });
    await journal.flush();
    expect(
      journal.status({ projectId: blank.projectId }).hasRecoverableSnapshot,
    ).toBe(true);

    const savePath = path.join(dir, "saved-as.mt");
    await journal.record({
      type: "saveAs",
      path: savePath,
      projectId: blank.projectId,
      at: new Date().toISOString(),
    });

    expect(journal.status({ projectId: blank.projectId }).dirty).toBe(false);
    expect(journal.status({ path: savePath }).dirty).toBe(false);
    expect(
      journal.peekRecovery({
        projectId: blank.projectId,
        documentJson: blank.documentJson,
      }),
    ).toBeNull();
    expect(
      journal.peekRecovery({
        path: savePath,
        documentJson: blank.documentJson,
      }),
    ).toBeNull();
  });

  it("discard clears projectId journal used for unsaved projects", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-journal-"));
    const journal = createProjectJournalService({ userDataPath: dir });
    const blank = buildBlankDesktopProject({ name: "HomeDiscard" });
    await journal.bind({ projectId: blank.projectId });
    await journal.writeAutosaveSnapshot({
      projectId: blank.projectId,
      documentJson: buildBlankDesktopProject({ name: "X" }).documentJson,
    });
    await journal.flush();
    await journal.discard({ projectId: blank.projectId });
    expect(
      journal.peekRecovery({
        projectId: blank.projectId,
        documentJson: blank.documentJson,
      }),
    ).toBeNull();
  });

  it("pending history after save is no-op (generation barrier)", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-journal-"));
    const journal = createProjectJournalService({ userDataPath: dir });
    const blank = buildBlankDesktopProject({ name: "RaceSave" });
    const filePath = path.join(dir, "race-save.mt");
    fs.writeFileSync(filePath, blank.documentJson);
    await journal.bind({
      projectId: blank.projectId,
      path: filePath,
      documentJson: blank.documentJson,
    });

    const historyPromise = journal.recordHistory({
      projectId: blank.projectId,
      path: filePath,
      entryId: "late",
      label: "Late",
      documentJsonHash: hashDocumentJson(
        buildBlankDesktopProject({ name: "Late" }).documentJson,
      ),
    });
    await journal.record({
      type: "save",
      path: filePath,
      projectId: blank.projectId,
      at: new Date().toISOString(),
    });
    const late = await historyPromise;
    await journal.flush();

    // Either history ran first then save cleared, or save invalidated history.
    expect(journal.status({ path: filePath }).dirty).toBe(false);
    expect(late.seq === 0 || late.seq >= 1).toBe(true);
    expect(
      journal.peekRecovery({
        path: filePath,
        documentJson: blank.documentJson,
      }),
    ).toBeNull();
  });

  it("pending autosave after discard leaves no recovery", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-journal-"));
    const journal = createProjectJournalService({ userDataPath: dir });
    const blank = buildBlankDesktopProject({ name: "RaceDiscard" });
    const filePath = path.join(dir, "race-discard.mt");
    fs.writeFileSync(filePath, blank.documentJson);
    await journal.bind({
      projectId: blank.projectId,
      path: filePath,
      documentJson: blank.documentJson,
    });

    const snap = buildBlankDesktopProject({ name: "PendingSnap" }).documentJson;
    const autosavePromise = journal.writeAutosaveSnapshot({
      projectId: blank.projectId,
      path: filePath,
      documentJson: snap,
    });
    await journal.discard({ path: filePath, projectId: blank.projectId });
    await autosavePromise;
    await journal.flush();

    expect(
      journal.peekRecovery({
        path: filePath,
        documentJson: blank.documentJson,
      }),
    ).toBeNull();
    expect(journal.status({ path: filePath }).hasRecoverableSnapshot).toBe(
      false,
    );
  });

  it("rejects invalid autosave and quarantines corrupt recovery snapshot", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-journal-"));
    const journal = createProjectJournalService({ userDataPath: dir });
    const blank = buildBlankDesktopProject({ name: "Valid" });
    const filePath = path.join(dir, "corrupt.mt");
    fs.writeFileSync(filePath, blank.documentJson);
    await journal.bind({
      projectId: blank.projectId,
      path: filePath,
      documentJson: blank.documentJson,
    });

    await expect(
      journal.writeAutosaveSnapshot({
        projectId: blank.projectId,
        path: filePath,
        documentJson: "{not-valid-json",
      }),
    ).rejects.toThrow(/validation/i);

    const good = buildBlankDesktopProject({ name: "GoodSnap" }).documentJson;
    await journal.writeAutosaveSnapshot({
      projectId: blank.projectId,
      path: filePath,
      documentJson: good,
    });
    await journal.flush();

    // Corrupt the snapshot file on disk after a valid write.
    const key = path.join(
      dir,
      "project-journals",
      // Find journal dir
      fs.readdirSync(path.join(dir, "project-journals"))[0]!,
    );
    const snapDir = path.join(key, "snapshots");
    const snapFile = fs
      .readdirSync(snapDir)
      .find((n) => n.startsWith("snapshot-") && n.endsWith(".json"));
    expect(snapFile).toBeTruthy();
    fs.writeFileSync(path.join(snapDir, snapFile!), "{broken");

    expect(
      journal.peekRecovery({
        path: filePath,
        documentJson: blank.documentJson,
      }),
    ).toBeNull();
    await journal.flush();

    const recovered = await journal.recover({ path: filePath });
    expect(recovered).toBeNull();
    expect(
      journal.peekRecovery({
        path: filePath,
        documentJson: blank.documentJson,
      }),
    ).toBeNull();
  });

  it("crash mid-snapshot leaves prior recoverable state", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-journal-"));
    const blank = buildBlankDesktopProject({ name: "Crash" });
    const filePath = path.join(dir, "crash.mt");
    fs.writeFileSync(filePath, blank.documentJson);

    const good = createProjectJournalService({ userDataPath: dir });
    await good.bind({
      projectId: blank.projectId,
      path: filePath,
      documentJson: blank.documentJson,
    });
    const prior = buildBlankDesktopProject({ name: "Prior" }).documentJson;
    await good.writeAutosaveSnapshot({
      projectId: blank.projectId,
      path: filePath,
      documentJson: prior,
    });
    await good.flush();

    const crashing = createProjectJournalService({
      userDataPath: dir,
      beforeSnapshotCommit: () => {
        throw new Error("simulated crash mid-write");
      },
    });
    const boom = buildBlankDesktopProject({ name: "Boom" }).documentJson;
    await expect(
      crashing.writeAutosaveSnapshot({
        projectId: blank.projectId,
        path: filePath,
        documentJson: boom,
      }),
    ).rejects.toThrow(/simulated crash/);
    await crashing.flush();

    const offer = crashing.peekRecovery({
      path: filePath,
      documentJson: blank.documentJson,
    });
    expect(offer).not.toBeNull();
    const recovered = await crashing.recover({ path: filePath });
    expect(recovered?.documentJson).toBe(prior);
  });

  it("migrateJournal keeps source when commit rename fails", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-journal-mig-"));
    const blank = buildBlankDesktopProject({ name: "Mig" });
    const destPath = path.join(dir, "dest.mt");
    const toDir = path.join(
      dir,
      "project-journals",
      journalKeyFor({ path: destPath })!,
    );
    const realRename = fs.renameSync.bind(fs);
    const journal = createProjectJournalService({
      userDataPath: dir,
      fs: {
        existsSync: fs.existsSync.bind(fs),
        mkdirSync: (p, opts) => fs.mkdirSync(p, opts),
        readFileSync: (p, enc) => fs.readFileSync(p, enc),
        writeFileSync: (p, data) => fs.writeFileSync(p, data),
        appendFileSync: (p, data) => fs.appendFileSync(p, data),
        readdirSync: (p) => fs.readdirSync(p),
        unlinkSync: (p) => fs.unlinkSync(p),
        rmSync: (p, opts) => fs.rmSync(p, opts),
        renameSync: (from, to) => {
          if (to === toDir) {
            throw new Error("commit rename failed");
          }
          realRename(from, to);
        },
      },
    });
    await journal.bind({ projectId: blank.projectId });
    await journal.writeAutosaveSnapshot({
      projectId: blank.projectId,
      documentJson: buildBlankDesktopProject({ name: "Snap" }).documentJson,
    });
    await journal.flush();

    await expect(
      journal.migrateJournal({
        from: { projectId: blank.projectId },
        to: { path: destPath, projectId: blank.projectId },
      }),
    ).rejects.toThrow(/commit rename failed/);

    expect(
      journal.peekRecovery({
        projectId: blank.projectId,
        documentJson: blank.documentJson,
      }),
    ).not.toBeNull();
  });
});
