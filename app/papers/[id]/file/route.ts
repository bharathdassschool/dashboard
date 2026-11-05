import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";
import { q1 } from "@/lib/db";

export const dynamic = "force-dynamic";

/** The original uploaded file (Manager, Admin, and the paper's reviewers). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await currentSession();
  if (!s) return new NextResponse("Unauthorized", { status: 401 });
  const pid = Number((await params).id);
  if (!Number.isInteger(pid)) return new NextResponse("Not found", { status: 404 });
  const row = await q1<{ file_name: string; file_type: string; file_data: Buffer | null; status: string; reviewer: boolean }>(
    `SELECT file_name, file_type, file_data, status,
       EXISTS (SELECT 1 FROM qp_reviewers r WHERE r.paper_id = p.id AND r.staff_id = $2) AS reviewer
     FROM qp_papers p WHERE id = $1`,
    [pid, s.staffId ?? 0],
  );
  const allowed = row && (s.role === "manager" || (s.role === "admin" && row.status !== "draft") || (s.role === "staff" && row.reviewer && row.status !== "draft"));
  if (!allowed || !row.file_data) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(row.file_data), {
    headers: {
      "Content-Type": row.file_type || "application/octet-stream",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(row.file_name || "paper")}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
