import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { closeDb, db } from "../db/client.js";
import { migrateDb } from "../db/migrate.js";
import { users } from "@findbarber/shared/schema";
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  passwordByteLength,
} from "@findbarber/shared/validation";
import { isUniqueViolation } from "../lib/errors.js";

function ask(query: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function askHidden(query: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(query);
    // Suppress terminal echo of the typed characters.
    const swallow = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });
    const rl = createInterface({
      input: process.stdin,
      output: swallow,
      terminal: true,
    });
    let value = "";
    rl.on("line", (line) => {
      value = line;
      rl.close();
    });
    rl.on("close", () => {
      process.stdout.write("\n");
      resolve(value);
    });
  });
}

async function main(): Promise<void> {
  await migrateDb();

  console.log("Create the first ADMIN account.\n");

  const email = await ask("Email: ");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Invalid email address.");
    process.exit(1);
  }

  const password = await askHidden(`Password (min ${PASSWORD_MIN_LENGTH} chars): `);
  if (password.length < PASSWORD_MIN_LENGTH) {
    console.error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
    process.exit(1);
  }
  if (passwordByteLength(password) > PASSWORD_MAX_BYTES) {
    console.error(`Password must not exceed ${PASSWORD_MAX_BYTES} bytes (bcrypt limit).`);
    process.exit(1);
  }

  const confirm = await askHidden("Confirm password: ");
  if (password !== confirm) {
    console.error("Passwords do not match.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    await db.insert(users).values({
      id: randomUUID(),
      email: email.toLowerCase(),
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      console.error("An account with this email already exists.");
      process.exit(1);
    }
    throw err;
  }

  console.log(`Admin account created for ${email.toLowerCase()}.`);
  await closeDb();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
