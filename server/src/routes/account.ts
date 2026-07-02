import { Router, type Request } from "express";
import type { AccountAdmin } from "../services/supabase-admin";

export function accountRouter(admin: AccountAdmin): Router {
  const r = Router();
  r.delete("/account", async (req, res) => {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) return res.status(401).json({ error: "unauthorized" });
    try {
      await admin.deleteUser(userId);
      res.status(204).end();
    } catch {
      res.status(502).json({ error: "deletion_failed" });
    }
  });
  return r;
}
