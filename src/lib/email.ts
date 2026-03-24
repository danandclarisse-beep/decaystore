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
