import nodemailer from "nodemailer";

const GMAIL_USER    = process.env.GMAIL_USER         ?? "";
const GMAIL_PASS    = process.env.GMAIL_APP_PASSWORD  ?? "";
const RESEND_KEY    = process.env.RESEND_API_KEY      ?? "";
const rawFrom       = process.env.FROM_EMAIL          ?? "";
const FROM_DISPLAY  = rawFrom
  ? (rawFrom.includes("<") ? rawFrom : `Bihashara <${rawFrom}>`)
  : "Bihashara <noreply@bihashara.app>";

function buildHtml(greeting: string, ownerName: string, shopName: string, role: string, inviteUrl: string) {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <div style="background:#1d4ed8;border-radius:12px 12px 0 0;padding:24px 28px">
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800">Bihashara</h1>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:28px">
        <p style="color:#111827;font-size:15px;margin:0 0 12px">${greeting}</p>
        <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px">
          <strong>${ownerName}</strong> has invited you to join
          <strong>${shopName}</strong> as <strong>${role}</strong> on Bihashara.
        </p>
        <a href="${inviteUrl}"
          style="display:inline-block;background:#1d4ed8;color:#fff;font-weight:700;
                 font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none">
          Accept Invitation
        </a>
        <p style="color:#6b7280;font-size:12px;margin:20px 0 0">
          This invite expires in 7 days. If you weren't expecting this, you can safely ignore it.
        </p>
        <p style="color:#9ca3af;font-size:11px;margin:8px 0 0">
          Or copy: ${inviteUrl}
        </p>
      </div>
    </div>`;
}

export async function sendStaffInviteEmail({
  to, shopName, ownerName, inviteUrl, role, fullName,
}: {
  to: string; shopName: string; ownerName: string;
  inviteUrl: string; role: string; fullName?: string;
}) {
  const greeting = fullName ? `Hi ${fullName},` : "Hello,";
  const subject  = `You're invited to join ${shopName} on Bihashara`;
  const html     = buildHtml(greeting, ownerName, shopName, role, inviteUrl);

  // ── 1. Gmail SMTP (preferred — works with any recipient) ─────────────────
  if (GMAIL_USER && GMAIL_PASS) {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    });
    await transporter.sendMail({
      from:    `Bihashara <${GMAIL_USER}>`,
      to,
      subject,
      html,
    });
    return;
  }

  // ── 2. Resend (requires verified domain for arbitrary recipients) ─────────
  if (RESEND_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ from: FROM_DISPLAY, to, subject, html }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Resend ${res.status}: ${txt}`);
    }
    return;
  }

  // ── 3. No transport configured ────────────────────────────────────────────
  console.log(`[email:no-transport] Invite for ${to} → ${inviteUrl}`);
  throw new Error("No email transport configured. Add GMAIL_USER + GMAIL_APP_PASSWORD to .env");
}
