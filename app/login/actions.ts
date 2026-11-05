"use server";

import { redirect } from "next/navigation";
import { action } from "@/lib/action";
import { checkLogin, endSession, startSession } from "@/lib/auth";

export const login = action(async (fd) => {
  const role = checkLogin(String(fd.get("username") ?? ""), String(fd.get("password") ?? ""));
  if (!role) throw new Error("Wrong username or password.");
  await startSession(role);
  redirect("/");
});

export async function logout() {
  await endSession();
  redirect("/login");
}
