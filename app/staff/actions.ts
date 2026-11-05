"use server";

import { revalidatePath } from "next/cache";
import { action } from "@/lib/action";
import { hashPassword, requireActor, ROLES } from "@/lib/auth";
import { q } from "@/lib/db";
import { id, str } from "@/lib/forms";

function fields(fd: FormData) {
  const name = str(fd, "name", 100);
  const username = str(fd, "username", 50).toLowerCase();
  if (!name) throw new Error("Type the staff member's name.");
  if (!/^[a-z0-9._-]{2,}$/.test(username)) throw new Error("Username: at least 2 letters or numbers, no spaces.");
  if ((ROLES as string[]).includes(username)) throw new Error(`"${username}" is one of the shared logins – choose another username.`);
  return { name, username, classes: str(fd, "classes", 500), subjects: str(fd, "subjects", 500) };
}

function password(fd: FormData) {
  const pw = String(fd.get("password") ?? "");
  if (pw.length < 4) throw new Error("Password: at least 4 characters.");
  return pw;
}

export const addStaff = action(async (fd) => {
  await requireActor("manager");
  const f = fields(fd);
  await q("INSERT INTO staff_accounts (name, username, password_hash, classes, subjects) VALUES ($1, $2, $3, $4, $5)", [
    f.name, f.username, await hashPassword(password(fd)), f.classes, f.subjects,
  ]).catch((e) => {
    throw /duplicate key/.test(String(e)) ? new Error("That username is taken.") : e;
  });
  revalidatePath("/staff");
  return `${f.name} can now sign in as "${f.username}".`;
});

export const updateStaff = action(async (fd) => {
  await requireActor("manager");
  const f = fields(fd);
  await q("UPDATE staff_accounts SET name=$1, username=$2, classes=$3, subjects=$4 WHERE id=$5", [f.name, f.username, f.classes, f.subjects, id(fd)]).catch((e) => {
    throw /duplicate key/.test(String(e)) ? new Error("That username is taken.") : e;
  });
  revalidatePath("/staff");
  return "Saved.";
});

export const resetStaffPassword = action(async (fd) => {
  await requireActor("manager");
  await q("UPDATE staff_accounts SET password_hash=$1 WHERE id=$2", [await hashPassword(password(fd)), id(fd)]);
  return "Password changed.";
});

export const setStaffActive = action(async (fd) => {
  await requireActor("manager");
  const on = fd.get("active") === "1";
  await q("UPDATE staff_accounts SET active=$1 WHERE id=$2", [on, id(fd)]);
  revalidatePath("/staff");
  return on ? "Switched on." : "Switched off – they can no longer sign in.";
});
