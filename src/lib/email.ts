import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

export async function sendDecayWarningEmail(
  email: string,
  filename: string,
  daysLeft: number,
  level: "warning" | "critical"
) {
  const subject =
    level === "critical"
      ? `⚠️ Final warning: "${filename}" deletes in ${daysLeft} days`
      : `Your file "${filename}" is decaying — ${daysLeft} days left`

  const color = level === "critical" ? "#ef4444" : "#f97316"
  const urgency = level === "critical" ? "FINAL WARNING" : "Heads up"

  await resend.emails.send({
    from: FROM,
    to: email,
    subject,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
        <div style="border-left: 4px solid ${color}; padding-left: 20px; margin-bottom: 32px;">
          <p style="font-size: 12px; font-weight: 600; color: ${color}; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px;">${urgency}</p>
          <h1 style="font-size: 22px; font-weight: 600; margin: 0;">"${filename}" is decaying</h1>
        </div>
        
        <p style="font-size: 16px; line-height: 1.6; color: #444;">
          This file hasn't been accessed in a while. It will be <strong>permanently deleted in ${daysLeft} days</strong> unless you renew it.
        </p>

        <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0; font-size: 14px; color: #666;">
            <strong style="color: #1a1a1a;">File:</strong> ${filename}<br/>
            <strong style="color: #1a1a1a;">Deletes in:</strong> ${daysLeft} days<br/>
            <strong style="color: #1a1a1a;">Action needed:</strong> Visit your dashboard and click Renew
          </p>
        </div>

        <a href="${APP_URL}/dashboard" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 14px;">
          Open Dashboard →
        </a>

        <p style="margin-top: 40px; font-size: 12px; color: #999;">
          This is an automated message from DecayStore. Renewing a file resets its decay clock to zero.
        </p>
      </body>
      </html>
    `,
  })
}

export async function sendDecayDeletedEmail(email: string, filename: string) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `"${filename}" has been deleted`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
        <div style="border-left: 4px solid #ef4444; padding-left: 20px; margin-bottom: 32px;">
          <p style="font-size: 12px; font-weight: 600; color: #ef4444; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px;">Deleted</p>
          <h1 style="font-size: 22px; font-weight: 600; margin: 0;">"${filename}" has been permanently deleted</h1>
        </div>
        
        <p style="font-size: 16px; line-height: 1.6; color: #444;">
          This file was not accessed within its decay window and has been permanently deleted from our servers. This cannot be undone.
        </p>

        <a href="${APP_URL}/dashboard" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 14px;">
          Go to Dashboard →
        </a>

        <p style="margin-top: 40px; font-size: 12px; color: #999;">
          Upgrade your plan to extend decay windows up to 90 days.
        </p>
      </body>
      </html>
    `,
  })
}

// ─── Weekly decay digest ───────────────────────────────────
// [P8-2] Sent by GET /api/cron/digest for Starter + Pro users.
// atRiskFiles must be pre-sorted by liveDecayScore descending.
export async function sendWeeklyDigestEmail(
  email: string,
  plan: string,
  atRiskFiles: Array<{
    id:             string
    originalFilename: string
    liveDecayScore: number
    decayRateDays:  number
    lastAccessedAt: Date
  }>
) {
  const isPro     = plan === "pro"
  const fileCount = atRiskFiles.length

  // Build per-file rows with a HMAC-signed one-click renew URL (7-day expiry)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const { createHmac } = await import("crypto")
  const secret  = process.env.CRON_SECRET ?? "fallback-secret"
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60

  function signedRenewUrl(fileId: string) {
    const payload = `${fileId}:${expiresAt}`
    const sig     = createHmac("sha256", secret).update(payload).digest("hex")
    return `${appUrl}/api/files/${fileId}/renew?expires=${expiresAt}&sig=${sig}`
  }

  const fileRows = atRiskFiles
    .slice(0, 10) // cap at 10 rows in email
    .map((f) => {
      const pct       = Math.round(f.liveDecayScore * 100)
      const daysLeft  = Math.max(0, Math.floor((1 - f.liveDecayScore) * f.decayRateDays))
      const barColor  = f.liveDecayScore >= 0.9 ? "#ef4444"
                      : f.liveDecayScore >= 0.75 ? "#f97316"
                      : "#eab308"
      const renewUrl  = signedRenewUrl(f.id)
      return `
        <tr style="border-bottom: 1px solid #f0f0f0;">
          <td style="padding: 10px 0; font-size: 14px; color: #1a1a1a; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${f.originalFilename}
          </td>
          <td style="padding: 10px 12px; font-size: 13px; font-weight: 600; color: ${barColor}; white-space: nowrap;">
            ${pct}% decayed
          </td>
          <td style="padding: 10px 0; font-size: 13px; color: #666; white-space: nowrap;">
            ${daysLeft}d left
          </td>
          <td style="padding: 10px 0; padding-left: 16px;">
            <a href="${renewUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 6px 14px; border-radius: 5px; text-decoration: none; font-size: 12px; font-weight: 500;">
              Renew
            </a>
          </td>
        </tr>`
    })
    .join("")

  const extraNote = fileCount > 10
    ? `<p style="font-size: 13px; color: #888; margin: 8px 0 0;">+${fileCount - 10} more file${fileCount - 10 === 1 ? "" : "s"} at risk — open your dashboard to see all.</p>`
    : ""

  const subject = `DecayStore digest: ${fileCount} file${fileCount === 1 ? "" : "s"} at risk this week`

  await resend.emails.send({
    from: FROM,
    to:   email,
    subject,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
        <div style="margin-bottom: 32px;">
          <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 6px;">Your weekly DecayStore digest</h1>
          <p style="font-size: 15px; color: #666; margin: 0;">${fileCount} file${fileCount === 1 ? " is" : "s are"} decaying — renew the ones you want to keep.</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
          <thead>
            <tr style="border-bottom: 2px solid #e5e5e5;">
              <th style="text-align: left; font-size: 12px; font-weight: 600; color: #999; padding-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">File</th>
              <th style="text-align: left; font-size: 12px; font-weight: 600; color: #999; padding-bottom: 8px; padding-left: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Decay</th>
              <th style="text-align: left; font-size: 12px; font-weight: 600; color: #999; padding-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">Time Left</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${fileRows}
          </tbody>
        </table>
        ${extraNote}

        <div style="margin-top: 32px;">
          <a href="${appUrl}/dashboard" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 14px;">
            Open Dashboard →
          </a>
        </div>

        <p style="margin-top: 40px; font-size: 12px; color: #bbb; border-top: 1px solid #f0f0f0; padding-top: 20px;">
          You're receiving this because you're on the ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan.
          ${isPro ? `<a href="${appUrl}/dashboard" style="color: #999; text-decoration: underline;">Manage digest preferences in your dashboard.</a>` : ""}
          Renew links expire in 7 days.
        </p>
      </body>
      </html>
    `,
  })
}

export async function sendWelcomeEmail(email: string) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Welcome to DecayStore",
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
        <h1 style="font-size: 28px; font-weight: 700; margin: 0 0 8px;">Welcome to DecayStore</h1>
        <p style="font-size: 16px; color: #888; margin: 0 0 32px;">Storage with a memory.</p>

        <p style="font-size: 16px; line-height: 1.6; color: #444;">
          Files you ignore will slowly decay and delete themselves. Files you care about, you'll renew. It's that simple.
        </p>

        <a href="${APP_URL}/dashboard" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 14px;">
          Upload your first file →
        </a>
      </body>
      </html>
    `,
  })
}