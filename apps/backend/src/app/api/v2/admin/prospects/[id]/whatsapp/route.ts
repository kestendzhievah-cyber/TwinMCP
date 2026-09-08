import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { prospects } from "@/db/schema";
import { badRequest, jsonError, notFound } from "@/lib/errors";
import { requireAdmin, logActivity } from "@/lib/admin/prospects-lib";
import { isWhatsappConfigured, sendProspectingTemplate } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  if (!isWhatsappConfigured()) {
    return jsonError(503, "WhatsApp non configuré — variables d'env manquantes côté serveur.");
  }

  const { id } = await params;
  const [p] = await getDb().select().from(prospects).where(eq(prospects.id, id));
  if (!p) return notFound("Prospect not found");
  if (!p.phone) return badRequest("Ce prospect n'a pas de numéro de téléphone.");

  try {
    const result = await sendProspectingTemplate({
      phone: p.phone,
      contactName: p.contactName,
      company: p.company,
    });
    await logActivity(id, "whatsapp", `Message envoyé au +${result.to}`, admin.userId).catch(
      () => {}
    );

    // A brand-new prospect auto-advances to "Contacté" once messaged.
    if (p.status === "new") {
      await getDb()
        .update(prospects)
        .set({ status: "contacted", updatedAt: new Date() })
        .where(eq(prospects.id, id));
      await logActivity(id, "status_change", "contacted", admin.userId).catch(() => {});
    }

    return NextResponse.json({ ok: true, id: result.id });
  } catch (e) {
    return jsonError(502, e instanceof Error ? e.message : "Échec de l'envoi WhatsApp.");
  }
}
