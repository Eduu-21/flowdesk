import { config, isTest } from '../config';
import { formatDateLong, formatTime12 } from '../utils/dates';

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Sends an email through Resend. When EMAIL_API_KEY is empty (development mode)
 * the message is printed to the server console instead. Never throws: a failed
 * email must not break the action that triggered it.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  if (!config.emailApiKey) {
    if (!isTest) {
      console.log(
        `\n──────── EMAIL (development mode, not sent) ────────\nTo:      ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n────────────────────────────────────────────────────\n`,
      );
    }
    return true;
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.emailApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.emailFrom,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!response.ok) {
      console.error(`Email provider rejected the message (${response.status}).`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Email could not be sent:', (err as Error).message);
    return false;
  }
}

function layout(studioName: string, heading: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f7f1ec;font-family:Georgia,'Times New Roman',serif;color:#2b2430">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px">
    <div style="text-align:center;padding-bottom:16px;font-size:22px;letter-spacing:1px;color:#5b2a50">${escapeHtml(studioName)}</div>
    <div style="background:#fffdfa;border:1px solid #eadfd6;border-radius:14px;padding:28px">
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#5b2a50">${escapeHtml(heading)}</h1>
      ${body}
    </div>
    <p style="text-align:center;font-size:12px;color:#8a7d86;margin-top:16px">Sent with FlowDesk</p>
  </div></body></html>`;
}

export interface AppointmentEmailData {
  studioName: string;
  customerName: string;
  customerEmail: string;
  serviceName: string;
  staffName: string;
  date: string;
  startTime: string;
}

function detailsBlock(d: AppointmentEmailData): { html: string; text: string } {
  const when = `${formatDateLong(d.date)} at ${formatTime12(d.startTime)}`;
  return {
    html: `<table style="width:100%;font-size:15px;line-height:1.7"><tr><td style="color:#8a7d86">Service</td><td>${escapeHtml(d.serviceName)}</td></tr><tr><td style="color:#8a7d86">With</td><td>${escapeHtml(d.staffName)}</td></tr><tr><td style="color:#8a7d86">When</td><td>${escapeHtml(when)}</td></tr></table>`,
    text: `Service: ${d.serviceName}\nWith: ${d.staffName}\nWhen: ${when}`,
  };
}

export function sendAppointmentConfirmation(d: AppointmentEmailData) {
  const block = detailsBlock(d);
  return sendEmail({
    to: d.customerEmail,
    subject: `Your appointment at ${d.studioName} is confirmed`,
    html: layout(
      d.studioName,
      'Your appointment is confirmed',
      `<p>Hi ${escapeHtml(d.customerName)}, we look forward to seeing you.</p>${block.html}`,
    ),
    text: `Hi ${d.customerName}, your appointment is confirmed.\n\n${block.text}`,
  });
}

export function sendAppointmentCancellation(d: AppointmentEmailData) {
  const block = detailsBlock(d);
  return sendEmail({
    to: d.customerEmail,
    subject: `Your appointment at ${d.studioName} was cancelled`,
    html: layout(
      d.studioName,
      'Your appointment was cancelled',
      `<p>Hi ${escapeHtml(d.customerName)}, the appointment below has been cancelled. Please get in touch if you would like to rebook.</p>${block.html}`,
    ),
    text: `Hi ${d.customerName}, your appointment has been cancelled.\n\n${block.text}`,
  });
}

export function sendAppointmentReminder(d: AppointmentEmailData) {
  const block = detailsBlock(d);
  return sendEmail({
    to: d.customerEmail,
    subject: `Reminder: your appointment at ${d.studioName} is coming up`,
    html: layout(
      d.studioName,
      'See you soon',
      `<p>Hi ${escapeHtml(d.customerName)}, this is a friendly reminder about your upcoming appointment.</p>${block.html}`,
    ),
    text: `Hi ${d.customerName}, a reminder about your upcoming appointment.\n\n${block.text}`,
  });
}

export function sendPasswordReset(to: string, name: string, resetUrl: string) {
  return sendEmail({
    to,
    subject: 'Reset your FlowDesk password',
    html: layout(
      'FlowDesk',
      'Reset your password',
      `<p>Hi ${escapeHtml(name)}, use the button below to choose a new password. The link is valid for one hour.</p>
       <p style="margin:24px 0"><a href="${escapeHtml(resetUrl)}" style="background:#5b2a50;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-family:Arial,sans-serif;font-size:14px">Choose a new password</a></p>
       <p style="font-size:13px;color:#8a7d86">If you did not ask for this, you can ignore this email.</p>`,
    ),
    text: `Hi ${name},\n\nChoose a new password here (valid for one hour):\n${resetUrl}\n\nIf you did not ask for this, ignore this email.`,
  });
}
