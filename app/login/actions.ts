"use server";

import { redirect } from "next/navigation";
import { action } from "@/lib/action";
import { checkLogin, endSession, startSession } from "@/lib/auth";

export const login = action(async (fd) => {
  const session = await checkLogin(String(fd.get("username") ?? ""), String(fd.get("password") ?? ""));
  if (!session) throw new Error("Wrong username or password.");
  await startSession(session);
  redirect("/");
});

export async function logout() {
  await endSession();
  redirect("/login");
}
