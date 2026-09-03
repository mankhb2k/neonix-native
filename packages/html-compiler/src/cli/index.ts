#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import {
  compileHtmlCss,
  type NeonixHtmlSourceV1,
} from "../index";
import { createHtmlProjectTemplate, type HtmlProjectExample } from "./templates";

const SOURCE_FILE = "neonix-source.json";
const PROTOCOL_FILE = "protocol-v2.json";

type CliResult = { exitCode: number };

export async function runCli(argv: readonly string[]): Promise<CliResult> {
  const [command, ...args] = argv;

  try {
    switch (command) {
      case "new":
        return await createProject(args);
      case "compile":
        return await compileProject(args);
      case "help":
      case "--help":
      case "-h":
      case undefined:
        printHelp();
        return { exitCode: command === undefined ? 0 : 0 };
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`html-compiler: ${message}`);
    console.error("Run `pnpm run cli -- help` for usage.");
    return { exitCode: 1 };
  }
}

async function createProject(args: readonly string[]): Promise<CliResult> {
  const targetArgument = args.find((arg) => !arg.startsWith("--"));
  if (!targetArgument) throw new Error("new requires a target directory");

  const exampleArgument = optionValue(args, "example") ?? "blank";
  if (!isHtmlProjectExample(exampleArgument)) {
    throw new Error(`unknown example: ${exampleArgument}; use blank or blue-rectangle`);
  }

  const targetDirectory = resolve(targetArgument);
  const sourcePath = join(targetDirectory, SOURCE_FILE);
  const protocolPath = join(targetDirectory, PROTOCOL_FILE);
  const source = createHtmlProjectTemplate(exampleArgument);
  const result = compileHtmlCss(source);
  if (result.status === "error" || result.protocol === null) {
    throw new Error(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"));
  }

  await mkdir(targetDirectory, { recursive: true });
  await writeNewFile(sourcePath, `${JSON.stringify(source, null, 2)}\n`);
  await writeNewFile(protocolPath, `${JSON.stringify(result.protocol, null, 2)}\n`);

  console.log(`Created ${displayPath(targetDirectory)}`);
  console.log(`  ${SOURCE_FILE} (${exampleArgument})`);
  console.log(`  ${PROTOCOL_FILE}`);
  return { exitCode: 0 };
}

async function compileProject(args: readonly string[]): Promise<CliResult> {
  const sourceArgument = args.find((arg) => !arg.startsWith("--"));
  if (!sourceArgument) throw new Error("compile requires a project directory or source file");

  const sourcePath = resolve(sourceArgument.endsWith(".json") ? sourceArgument : join(sourceArgument, SOURCE_FILE));
  const outputArgument = optionValue(args, "out");
  const outputPath = resolve(outputArgument ?? join(dirname(sourcePath), PROTOCOL_FILE));
  const source = parseSource(await readFile(sourcePath, "utf8"));
  const result = compileHtmlCss(source);

  if (result.status === "error" || result.protocol === null) {
    const diagnostics = result.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`).join("\n");
    throw new Error(diagnostics);
  }

  await writeFile(outputPath, `${JSON.stringify(result.protocol, null, 2)}\n`, "utf8");
  console.log(`Compiled ${displayPath(sourcePath)} -> ${displayPath(outputPath)}`);
  return { exitCode: 0 };
}

function parseSource(value: string): NeonixHtmlSourceV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("source file is not valid JSON");
  }

  if (!isRecord(parsed) || parsed.kind !== "neonix-html-source" || parsed.sourceSchemaVersion !== 1 || typeof parsed.html !== "string" || typeof parsed.css !== "string" || !isRecord(parsed.composition)) {
    throw new Error(`source file must be a NeonixHtmlSourceV1 document`);
  }

  return parsed as unknown as NeonixHtmlSourceV1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionValue(args: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

function isHtmlProjectExample(value: string): value is HtmlProjectExample {
  return value === "blank" || value === "blue-rectangle";
}

async function writeNewFile(path: string, content: string): Promise<void> {
  try {
    await writeFile(path, content, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") {
      throw new Error(`${displayPath(path)} already exists; choose another directory`);
    }
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function displayPath(path: string): string {
  const relative = isAbsolute(path) ? path.replace(`${process.cwd()}\\`, "").replace(`${process.cwd()}/`, "") : path;
  return relative || basename(path);
}

function printHelp(): void {
  console.log(`Usage:
  pnpm run cli -- new <directory> [--example blank|blue-rectangle]
  pnpm run cli -- compile <directory|neonix-source.json> [--out protocol-v2.json]

Examples:
  pnpm run cli -- new ./fixtures/new-project
  pnpm run cli -- new ./fixtures/p0/blue-rectangle --example blue-rectangle
  pnpm run cli -- compile ./fixtures/p0/blue-rectangle`);
}

if (process.argv[1] && /[\\/]src[\\/]cli[\\/]index\.ts$/.test(process.argv[1])) {
  const result = await runCli(process.argv.slice(2));
  process.exitCode = result.exitCode;
}
