import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

// ─── Shared branded chrome ────────────────────────────────────────────────────
// Used by all templates. Text-based logo renders reliably across all
// email clients (image logos are frequently blocked by default).

function emailHeader() {
  return `
    <div style="border-bottom: 2px solid #f5a623; padding-bottom: 16px; margin-bottom: 32px;">
      <span style="font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: #0a0a0b;">
        Decay<span style="color: #f5a623;">Store</span>
      </span>
    </div>
  `
}

function emailFooter(appUrl: string) {
  return `
    <div style="border-top: 1px solid #e5e5e5; margin-top: 40px; padding-top: 20px;">
      <p style="font-size: 12px; color: #bbb; margin: 0;">
        DecayStore — Storage with a memory. &middot;
        <a href="${appUrl}/account" style="color: #999; text-decoration: underline;">Manage preferences</a>
      </p>
    </div>
  `
}

function ctaButton(href: string, label: string) {
  return `
    <a href="${href}" style="display: inline-block; background: #f5a623; color: #000;
       padding: 12px 24px; border-radius: 6px; text-decoration: none;
       font-weight: 600; font-size: 14px;">
      ${label}
    </a>
  `
}

// ─── Decay warning ────────────────────────────────────────────────────────────

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

  const accentColor = level === "critical" ? "#ef4444" : "#f5a623"
  const urgency     = level === "critical" ? "FINAL WARNING" : "Heads up"

  await resend.emails.send({
    from: FROM,
    to: email,
    subject,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
        ${emailHeader()}

        <div style="border-left: 4px solid ${accentColor}; padding-left: 20px; margin-bottom: 32px;">
          <p style="font-size: 12px; font-weight: 600; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px;">${urgency}</p>
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

        ${ctaButton(`${APP_URL}/dashboard`, "Open Dashboard →")}

        ${emailFooter(APP_URL)}
      </body>
      </html>
    `,
  })
}

// ─── Decay deleted ────────────────────────────────────────────────────────────

export async function sendDecayDeletedEmail(email: string, filename: string) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `"${filename}" has been deleted`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
        ${emailHeader()}

        <div style="border-left: 4px solid #ef4444; padding-left: 20px; margin-bottom: 32px;">
          <p style="font-size: 12px; font-weight: 600; color: #ef4444; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px;">Deleted</p>
          <h1 style="font-size: 22px; font-weight: 600; margin: 0;">"${filename}" has been permanently deleted</h1>
        </div>

        <p style="font-size: 16px; line-height: 1.6; color: #444;">
          This file was not accessed within its decay window and has been permanently deleted from our servers. This cannot be undone.
        </p>

        ${ctaButton(`${APP_URL}/dashboard`, "Go to Dashboard →")}

        <p style="margin-top: 24px; font-size: 13px; color: #888;">
          Upgrade your plan to extend decay windows up to 90 days.
        </p>

        ${emailFooter(APP_URL)}
      </body>
      </html>
    `,
  })
}

// ─── Weekly decay digest ──────────────────────────────────────────────────────
// [P8-2] Sent by GET /api/cron/digest for Starter + Pro users.

export async function sendWeeklyDigestEmail(
  email: string,
  plan: string,
  atRiskFiles: Array<{
    id:               string
    originalFilename: string
    liveDecayScore:   number
    decayRateDays:    number
    lastAccessedAt:   Date
  }>
) {
  const isPro     = plan === "pro"
  const fileCount = atRiskFiles.length

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const { createHmac } = await import("crypto")
  const secret    = process.env.CRON_SECRET ?? "fallback-secret"
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60

  function signedRenewUrl(fileId: string) {
    const payload = `${fileId}:${expiresAt}`
    const sig     = createHmac("sha256", secret).update(payload).digest("hex")
    return `${appUrl}/api/files/${fileId}/renew?expires=${expiresAt}&sig=${sig}`
  }

  const fileRows = atRiskFiles
    .slice(0, 10)
    .map((f) => {
      const pct      = Math.round(f.liveDecayScore * 100)
      const daysLeft = Math.max(0, Math.floor((1 - f.liveDecayScore) * f.decayRateDays))
      const barColor = f.liveDecayScore >= 0.9  ? "#ef4444"
                     : f.liveDecayScore >= 0.75 ? "#f97316"
                     : "#f5a623"
      const renewUrl = signedRenewUrl(f.id)
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
            <a href="${renewUrl}" style="display: inline-block; background: #f5a623; color: #000;
               padding: 6px 14px; border-radius: 5px; text-decoration: none;
               font-size: 12px; font-weight: 600;">
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
        ${emailHeader()}

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
          ${ctaButton(`${appUrl}/dashboard`, "Open Dashboard →")}
        </div>

        <p style="margin-top: 24px; font-size: 13px; color: #888;">
          You're receiving this because you're on the ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan.
          ${isPro ? `<a href="${appUrl}/account" style="color: #999; text-decoration: underline;">Manage digest preferences.</a>` : ""}
          Renew links expire in 7 days.
        </p>

        ${emailFooter(appUrl)}
      </body>
      </html>
    `,
  })
}

// ─── Welcome ──────────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(email: string) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Welcome to DecayStore",
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
        ${emailHeader()}

        <h1 style="font-size: 28px; font-weight: 700; margin: 0 0 8px;">Welcome to DecayStore</h1>
        <p style="font-size: 16px; color: #888; margin: 0 0 32px;">Intentional storage. Only what you use survives.</p>

        <p style="font-size: 16px; line-height: 1.6; color: #444;">
          Files you ignore will slowly decay and delete themselves. Files you care about, you'll renew. It's that simple.
        </p>

        <ul style="font-size: 15px; line-height: 1.8; color: #555; padding-left: 20px; margin: 24px 0;">
          <li><strong>Upload</strong> — drag in any file up to your plan limit</li>
          <li><strong>Decay</strong> — ignored files score toward deletion over time</li>
          <li><strong>Renew</strong> — access or explicitly renew files you want to keep</li>
        </ul>

        ${ctaButton(`${APP_URL}/dashboard`, "Upload your first file →")}

        ${emailFooter(APP_URL)}
      </body>
      </html>
    `,
  })
}

// ─── [P18] Waitlist confirmation ──────────────────────────────────────────────

export async function sendWaitlistConfirmationEmail(email: string, position: number) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "You're on the DecayStore waitlist",
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
        ${emailHeader()}
        <h1 style="font-size: 22px; font-weight: 600;">You're on the list</h1>
        <p style="font-size: 16px; line-height: 1.6; color: #444;">
          You're <strong>#${position}</strong> in the queue. We're opening spots in batches of 25.
          We'll email you the moment yours is ready — no action needed until then.
        </p>
        <p style="font-size: 14px; color: #666;">
          When your spot opens, you'll get a personal invite link valid for 48 hours.
          It includes a 14-day Pro trial — no charge until day 15.
        </p>
        ${emailFooter(APP_URL)}
      </body>
      </html>
    `,
  })
}

// ─── [P18] Waitlist approved ──────────────────────────────────────────────────

export async function sendWaitlistApprovedEmail(email: string, token: string) {
  const signupUrl = `${APP_URL}/auth/sign-up?token=${token}`

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Your spot is ready — claim it in 48 hours",
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
        ${emailHeader()}
        <h1 style="font-size: 22px; font-weight: 600;">Your spot is ready</h1>
        <p style="font-size: 16px; line-height: 1.6; color: #444;">
          You're in. Use the link below to create your account — it expires in <strong>48 hours</strong>.
        </p>
        <div style="margin: 32px 0;">
          ${ctaButton(signupUrl, "Claim your spot →")}
        </div>
        <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; font-size: 14px; color: #555;">
          <strong>What happens next:</strong><br/>
          You'll start a 14-day Pro trial — full Pro features, 1 GB storage cap.<br/>
          A payment method is required upfront. You won't be charged until day 15.
        </div>
        <p style="font-size: 12px; color: #999; margin-top: 24px;">
          This link expires in 48 hours. If it expires, you'll be placed back in the queue automatically.
        </p>
        ${emailFooter(APP_URL)}
      </body>
      </html>
    `,
  })
}

// ─── [P18] Waitlist token expired ─────────────────────────────────────────────

export async function sendWaitlistTokenExpiredEmail(email: string) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Your invite expired — you're back in the queue",
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
        ${emailHeader()}
        <h1 style="font-size: 22px; font-weight: 600;">Your invite expired</h1>
        <p style="font-size: 16px; line-height: 1.6; color: #444;">
          Your 48-hour invite link wasn't used, so we've returned your spot to the pool.
          You're back in the queue and will receive a new invite when the next batch opens.
        </p>
        ${emailFooter(APP_URL)}
      </body>
      </html>
    `,
  })
}

// ─── [P18] Trial warning (day 10 → daysLeft=4, day 13 → daysLeft=1) ──────────

export async function sendTrialWarningEmail(email: string, daysLeft: number) {
  const isFinal = daysLeft === 1
  const subject = isFinal
    ? "Last day of your DecayStore trial"
    : `Your trial ends in ${daysLeft} days`

  await resend.emails.send({
    from: FROM,
    to: email,
    subject,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
        ${emailHeader()}
        <div style="border-left: 4px solid #f5a623; padding-left: 20px; margin-bottom: 32px;">
          <p style="font-size: 12px; font-weight: 600; color: #f5a623; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px;">
            ${isFinal ? "FINAL WARNING" : "TRIAL ENDING SOON"}
          </p>
          <h1 style="font-size: 22px; font-weight: 600; margin: 0;">
            ${isFinal ? "Your trial ends tomorrow" : `${daysLeft} days left on your trial`}
          </h1>
        </div>
        <p style="font-size: 16px; line-height: 1.6; color: #444;">
          After your trial ends, uploads will be paused and your files will begin a 14-day decay countdown.
          Subscribe to Pro to keep everything running.
        </p>
        <div style="margin: 32px 0;">
          ${ctaButton(`${APP_URL}/pricing`, "Upgrade to Pro — $15/mo")}
        </div>
        ${emailFooter(APP_URL)}
      </body>
      </html>
    `,
  })
}

// ─── [P18] Trial expired ──────────────────────────────────────────────────────

export async function sendTrialExpiredEmail(email: string, firstDeletionDate: Date) {
  const dateStr = firstDeletionDate.toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  })

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Your trial has ended — your files will decay in 14 days",
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
        ${emailHeader()}
        <div style="border-left: 4px solid #ef4444; padding-left: 20px; margin-bottom: 32px;">
          <p style="font-size: 12px; font-weight: 600; color: #ef4444; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px;">TRIAL ENDED</p>
          <h1 style="font-size: 22px; font-weight: 600; margin: 0;">Your trial has ended</h1>
        </div>
        <p style="font-size: 16px; line-height: 1.6; color: #444;">
          Uploads are now paused. Your existing files are safe for now, but will begin
          deleting on <strong>${dateStr}</strong> unless you subscribe.
        </p>
        <div style="margin: 32px 0;">
          ${ctaButton(`${APP_URL}/pricing`, "Subscribe to Pro — $15/mo")}
        </div>
        <p style="font-size: 14px; color: #666;">
          Downloads are always available — you can retrieve your files at any time.
        </p>
        ${emailFooter(APP_URL)}
      </body>
      </html>
    `,
  })
}

// ─── [P18] Trial decay warning (day 21 — 7 days before first deletion) ────────

export async function sendTrialDecayWarningEmail(email: string, firstDeletionDate: Date) {
  const dateStr = firstDeletionDate.toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  })

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Files will be deleted in 7 days",
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
        ${emailHeader()}
        <div style="border-left: 4px solid #ef4444; padding-left: 20px; margin-bottom: 32px;">
          <p style="font-size: 12px; font-weight: 600; color: #ef4444; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px;">DELETION WARNING</p>
          <h1 style="font-size: 22px; font-weight: 600; margin: 0;">Files will be deleted in 7 days</h1>
        </div>
        <p style="font-size: 16px; line-height: 1.6; color: #444;">
          Your files will be permanently deleted starting <strong>${dateStr}</strong>.
          Subscribe to Pro to stop the deletion clock immediately.
        </p>
        <div style="margin: 32px 0;">
          ${ctaButton(`${APP_URL}/pricing`, "Subscribe to Pro — $15/mo")}
        </div>
        ${emailFooter(APP_URL)}
      </body>
      </html>
    `,
  })
}