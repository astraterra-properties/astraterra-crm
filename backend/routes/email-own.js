/**
 * Astraterra Own Email Marketing System
 * Sends ALL emails via Gmail OAuth — no Brevo dependency
 *
 * Public (no auth):
 *   POST /api/email-own/welcome     — send welcome email to a new subscriber
 *   POST /api/email-own/subscribe   — subscribe + send welcome (called by website)
 *
 * Admin (auth required):
 *   GET  /api/email-own/subscribers          — list all subscribers
 *   POST /api/email-own/subscribers/import   — import from contacts table
 *   DELETE /api/email-own/subscribers/:id    — remove subscriber
 *   GET  /api/email-own/campaigns            — list campaigns
 *   POST /api/email-own/campaigns            — create draft campaign
 *   POST /api/email-own/campaigns/:id/send   — send campaign to all active subscribers
 *   GET  /api/email-own/stats                — dashboard stats
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken: auth, requireMinRole } = require('../middleware/auth');
const { google } = require('googleapis');

// ─── Gmail OAuth ─────────────────────────────────────────────────────────────
const GMAIL_CLIENT_ID     = '755978414447-dsptstqakm3jna7li6fm5hnlmr7ogv5m.apps.googleusercontent.com';
const GMAIL_CLIENT_SECRET = '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';
const GMAIL_REFRESH_TOKEN = '1//0gxC7sM6PDgb3CgYIARAAGBASNwF-L9IrUGzadEquKq6GV6dpyD5WnhLZ2ZvwWZrq2-6BFaZrAwxlRWhooC6XLvHXpgNIFTNK24A';
const GMAIL_USER          = 'admin@astraterra.ae';
const FROM_NAME           = 'Joseph @ Astraterra Properties';

const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, 'http://localhost');
oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
const gmailApi = google.gmail({ version: 'v1', auth: oauth2Client });

function encodeSubject(subject) {
  // RFC 2047 encoding for non-ASCII characters (emojis, Arabic, etc.)
  const hasNonAscii = /[^\x00-\x7F]/.test(subject);
  if (!hasNonAscii) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
}

function encodeName(name) {
  const hasNonAscii = /[^\x00-\x7F]/.test(name);
  if (!hasNonAscii) return `"${name}"`;
  return `=?UTF-8?B?${Buffer.from(name, 'utf8').toString('base64')}?=`;
}

async function sendViaGmail({ to, subject, html, text }) {
  const fromHeader = `${encodeName(FROM_NAME)} <${GMAIL_USER}>`;
  const boundary = `astra_${Date.now()}`;
  const rawLines = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
    '',
    `--${boundary}--`,
  ];
  const raw = Buffer.from(rawLines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const result = await gmailApi.users.messages.send({ userId: 'me', requestBody: { raw } });
  return result.data.id;
}

// ─── Astraterra Branded Campaign Template (matches Brevo campaign #10 design) ──

function buildAstraterraTemplate({
  editionLabel = 'Market Update',
  editionDate = '',
  eyebrow = 'Exclusive Client Briefing',
  headlineWhite = '',
  headlineGold = '',
  subtitle = '',
  greeting = '',
  introText = '',
  projects = [],   // [{ developer, projectName, location, startingPrice, bedrooms, handover, waLink }]
  ctaText = 'Interested in any of these projects?',
  ctaSubtext = "Message us directly — we'll provide floor plans, payment schedules and ROI projections within the hour.",
  firstName = 'Valued Investor',
}) {
  const logoUrl = 'https://res.cloudinary.com/dumt7udjd/image/upload/v1771688053/astraterra-logo-email.png';
  const dateStr = editionDate || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const greetingText = greeting || `Dear ${firstName},`;

  const projectCards = projects.map(p => {
    const waMsg = encodeURIComponent(`I'm interested in ${p.projectName}`);
    const waUrl = p.waLink || `https://wa.me/971585580053?text=${waMsg}`;
    return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid rgba(196,168,108,0.15);border-radius:6px;overflow:hidden;">
  <tr>
    <td style="background:rgba(196,168,108,0.05);padding:26px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-bottom:12px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:linear-gradient(135deg,#C9A96E,#8A6F2F);border-radius:2px;padding:4px 10px;">
                        <span style="font-family:'Montserrat',sans-serif;font-size:8px;font-weight:700;color:#0d1625;letter-spacing:2px;text-transform:uppercase;">${p.developer || 'Developer'}</span>
                      </td>
                    </tr>
                  </table>
                </td>
                ${p.handover ? `<td style="text-align:right;"><span style="font-family:'Montserrat',sans-serif;font-size:9px;color:rgba(196,168,108,0.6);letter-spacing:1px;">Handover: ${p.handover}</span></td>` : '<td></td>'}
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td>
            <div style="font-family:'Playfair Display',serif;font-size:20px;font-weight:600;color:#ffffff;line-height:1.3;margin-bottom:10px;">${p.projectName || 'Project Name'}</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
              <tr>
                ${p.location ? `<td style="width:33%;vertical-align:top;"><div style="font-family:'Montserrat',sans-serif;font-size:8px;color:rgba(196,168,108,0.5);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Location</div><div style="font-family:'Montserrat',sans-serif;font-size:11px;color:rgba(255,255,255,0.7);">${p.location}</div></td>` : ''}
                ${p.startingPrice ? `<td style="width:33%;vertical-align:top;"><div style="font-family:'Montserrat',sans-serif;font-size:8px;color:rgba(196,168,108,0.5);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">From</div><div style="font-family:'Playfair Display',serif;font-size:13px;font-weight:600;color:#C9A96E;">${p.startingPrice.startsWith('AED') ? p.startingPrice : 'AED ' + p.startingPrice}</div></td>` : ''}
                ${p.bedrooms ? `<td style="width:34%;vertical-align:top;"><div style="font-family:'Montserrat',sans-serif;font-size:8px;color:rgba(196,168,108,0.5);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Bedrooms</div><div style="font-family:'Montserrat',sans-serif;font-size:11px;color:rgba(255,255,255,0.7);">${p.bedrooms}</div></td>` : ''}
              </tr>
            </table>
            <a href="${waUrl}" style="display:inline-block;padding:10px 28px;background:linear-gradient(135deg,#C9A96E 0%,#B8943D 50%,#8A6F2F 100%);color:#131B2B;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-decoration:none;border-radius:30px;">Enquire Now</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${headlineWhite} ${headlineGold} — Astraterra Properties</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
</head>
<body style="margin:0;padding:0;background-color:#0c1220;font-family:'Montserrat',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0c1220;padding:0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;">

        <tr><td style="height:32px;"></td></tr>

        <!-- HEADER BAND -->
        <tr>
          <td style="background:#131B2B;border-radius:6px 6px 0 0;padding:28px 44px;border-bottom:1px solid rgba(196,168,108,0.18);">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="vertical-align:middle;">
                <img src="${logoUrl}" alt="Astraterra Properties" width="160" style="display:block;border:0;max-width:160px;"/>
              </td>
              <td style="vertical-align:middle;text-align:right;">
                <div style="font-family:'Montserrat',sans-serif;font-size:9px;color:rgba(196,168,108,0.55);letter-spacing:3px;text-transform:uppercase;">${dateStr}</div>
                <div style="font-family:'Montserrat',sans-serif;font-size:9px;color:rgba(196,168,108,0.35);letter-spacing:2px;text-transform:uppercase;margin-top:4px;">${editionLabel}</div>
              </td>
            </tr></table>
          </td>
        </tr>

        <!-- HERO -->
        <tr>
          <td style="background:linear-gradient(175deg,#16223A 0%,#131B2B 45%,#0e1827 100%);padding:48px 44px 40px;">
            <div style="font-family:'Montserrat',sans-serif;font-size:9px;color:#C9A96E;letter-spacing:5px;text-transform:uppercase;margin-bottom:18px;opacity:0.9;">${eyebrow}</div>
            <h1 style="margin:0 0 6px;font-family:'Playfair Display',serif;font-size:36px;font-weight:600;color:#ffffff;line-height:1.2;letter-spacing:-0.5px;">${headlineWhite}</h1>
            <h1 style="margin:0 0 22px;font-family:'Playfair Display',serif;font-size:36px;font-weight:400;color:#C9A96E;line-height:1.2;letter-spacing:-0.5px;font-style:italic;">${headlineGold}</h1>
            <p style="margin:0 0 32px;font-family:'Cormorant Garamond',serif;font-size:17px;color:rgba(255,255,255,0.5);line-height:1.8;font-weight:300;max-width:440px;">${subtitle}</p>
            <div style="width:48px;height:1px;background:linear-gradient(to right,#C9A96E,#8A6F2F);"></div>
          </td>
        </tr>

        <!-- GOLD LINE -->
        <tr><td style="height:2px;background:linear-gradient(to right,#8A6F2F,#C9A96E 50%,#8A6F2F);"></td></tr>

        <!-- CONTENT SECTION -->
        <tr>
          <td style="background:#131B2B;padding:40px 44px 16px;">
            <p style="margin:0 0 8px;font-family:'Cormorant Garamond',serif;font-size:17px;color:rgba(255,255,255,0.85);line-height:1.8;">${greetingText}</p>
            <p style="margin:0 0 36px;font-family:'Cormorant Garamond',serif;font-size:16px;color:rgba(255,255,255,0.45);line-height:1.85;font-weight:300;">${introText}</p>
            ${projectCards || '<p style="color:rgba(255,255,255,0.3);font-size:14px;font-family:Montserrat,sans-serif;">No project cards added.</p>'}
          </td>
        </tr>

        <!-- SIGNATURE -->
        <tr>
          <td style="background:#131B2B;padding:0 44px 40px;">
            <div style="height:1px;background:linear-gradient(to right,transparent,rgba(196,168,108,0.2),transparent);margin-bottom:32px;"></div>
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="vertical-align:top;width:48px;height:48px;background:linear-gradient(145deg,rgba(201,169,110,0.15),rgba(138,111,47,0.08));border-radius:50%;border:1px solid rgba(196,168,108,0.25);text-align:center;line-height:48px;">
                <span style="font-family:'Playfair Display',serif;font-size:15px;color:#C9A96E;font-weight:700;">JT</span>
              </td>
              <td style="padding-left:14px;vertical-align:middle;">
                <div style="font-family:'Montserrat',sans-serif;font-size:13px;font-weight:600;color:#ffffff;letter-spacing:0.5px;">Joseph Toubia</div>
                <div style="font-family:'Montserrat',sans-serif;font-size:10px;color:rgba(255,255,255,0.35);margin-top:3px;letter-spacing:0.5px;">Founder — Astraterra Properties</div>
                <div style="font-family:'Montserrat',sans-serif;font-size:10px;color:#C9A96E;margin-top:5px;opacity:0.8;">+971 58 558 0053</div>
              </td>
            </tr></table>
          </td>
        </tr>

        <!-- CTA BANNER -->
        <tr>
          <td style="background:linear-gradient(135deg,#1c2e4a 0%,#162240 100%);padding:36px 44px;text-align:center;border-top:1px solid rgba(196,168,108,0.12);border-bottom:1px solid rgba(196,168,108,0.12);">
            <div style="font-family:'Playfair Display',serif;font-size:22px;color:#ffffff;margin-bottom:8px;font-weight:400;">${ctaText}</div>
            <p style="margin:0 0 24px;font-family:'Cormorant Garamond',serif;font-size:15px;color:rgba(255,255,255,0.4);font-weight:300;">${ctaSubtext}</p>
            <a href="https://wa.me/971585580053" style="display:inline-block;padding:14px 44px;background:linear-gradient(135deg,#C9A96E 0%,#B8943D 50%,#8A6F2F 100%);color:#131B2B;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;text-decoration:none;border-radius:30px;">WhatsApp Us Now</a>
            &nbsp;&nbsp;
            <a href="https://astraterra.ae" style="display:inline-block;margin-top:12px;padding:13px 32px;background:transparent;color:#C9A96E;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;text-decoration:none;border-radius:30px;border:1px solid rgba(196,168,108,0.4);">Visit Website</a>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#0e1520;border-radius:0 0 6px 6px;padding:24px 44px;text-align:center;">
            <img src="${logoUrl}" alt="Astraterra" width="100" style="display:block;margin:0 auto 16px;opacity:0.4;"/>
            <div style="height:1px;background:linear-gradient(to right,transparent,rgba(196,168,108,0.1),transparent);margin-bottom:16px;"></div>
            <p style="margin:0 0 6px;font-family:'Montserrat',sans-serif;font-size:10px;color:rgba(255,255,255,0.18);letter-spacing:0.5px;">
              © ${new Date().getFullYear()} Astraterra Properties L.L.C &nbsp;·&nbsp; Dubai, UAE &nbsp;·&nbsp; RERA Licensed &nbsp;·&nbsp; Trade License 1384302
            </p>
            <p style="margin:0;font-family:'Montserrat',sans-serif;font-size:10px;color:rgba(255,255,255,0.12);">
              You received this as a valued client of Astraterra Properties.&nbsp;&nbsp;<a href="https://www.astraterra.ae/unsubscribe?email={{email}}" style="color:rgba(201,169,110,0.3);text-decoration:none;">Unsubscribe</a>
            </p>
          </td>
        </tr>

        <tr><td style="height:32px;"></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── HTML Templates ───────────────────────────────────────────────────────────

function welcomeEmailHtml(firstName) {
  const name = firstName && firstName !== 'there' ? firstName : 'there';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Welcome to Astraterra Insider</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#131B2B 0%,#1e2a3d 100%);border-radius:16px 16px 0 0;padding:36px 40px;text-align:center;">
        <div style="font-size:13px;letter-spacing:3px;color:#C5A265;text-transform:uppercase;font-weight:700;margin-bottom:12px;">ASTRATERRA PROPERTIES</div>
        <h1 style="margin:0;font-size:28px;font-weight:700;color:#ffffff;line-height:1.3;">
          Welcome to the<br/><span style="color:#C5A265;">Astraterra Insider</span> 🏙️
        </h1>
        <p style="margin:14px 0 0;font-size:14px;color:rgba(255,255,255,0.65);line-height:1.6;">
          Dubai's sharpest real estate intelligence — straight to your inbox
        </p>
      </td></tr>

      <!-- Body -->
      <tr><td style="background:#ffffff;padding:40px;">
        <p style="margin:0 0 20px;font-size:16px;color:#1a1a2e;line-height:1.7;">
          Hi ${name},
        </p>
        <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.8;">
          I'm Joseph Toubia, CEO of Astraterra Properties. Thank you for subscribing — you've just joined 
          an exclusive community of savvy investors and homebuyers who get the inside edge on Dubai's property market.
        </p>

        <!-- Divider -->
        <div style="height:1px;background:linear-gradient(90deg,transparent,#C5A265,transparent);margin:28px 0;"></div>

        <p style="margin:0 0 20px;font-size:14px;font-weight:700;color:#131B2B;letter-spacing:1px;text-transform:uppercase;">What to expect</p>

        <!-- 3 value props -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
          ${[
            ['📊', 'Market Intelligence', 'Monthly price trends, transaction data, and area insights — before they hit the news.'],
            ['🏗️', 'Off-Plan Alerts', 'Early access to the best new launches from Emaar, Nakheel, DAMAC, and more.'],
            ['🤝', 'Expert Guidance', 'Tips on mortgages, ROI calculations, Golden Visa eligibility, and legal due diligence.'],
          ].map(([icon, title, desc]) => `
          <tr><td style="padding:0 0 16px;">
            <table cellpadding="0" cellspacing="0" width="100%"><tr>
              <td width="48" valign="top">
                <div style="width:40px;height:40px;background:linear-gradient(135deg,#131B2B,#1e2a3d);border-radius:10px;text-align:center;line-height:40px;font-size:18px;">${icon}</div>
              </td>
              <td style="padding-left:14px;">
                <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#131B2B;">${title}</p>
                <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6;">${desc}</p>
              </td>
            </tr></table>
          </td></tr>`).join('')}
        </table>

        <!-- Stats bar -->
        <div style="background:linear-gradient(135deg,#131B2B,#1e2a3d);border-radius:12px;padding:20px 24px;margin-bottom:28px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="text-align:center;">
                <p style="margin:0;font-size:22px;font-weight:800;color:#C5A265;">AED 1.3T</p>
                <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.6);">2024 Transaction Volume</p>
              </td>
              <td style="text-align:center;border-left:1px solid rgba(197,162,101,0.3);border-right:1px solid rgba(197,162,101,0.3);">
                <p style="margin:0;font-size:22px;font-weight:800;color:#C5A265;">180+</p>
                <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.6);">Nationalities Investing</p>
              </td>
              <td style="text-align:center;">
                <p style="margin:0;font-size:22px;font-weight:800;color:#C5A265;">7-9%</p>
                <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.6);">Average Rental Yield</p>
              </td>
            </tr>
          </table>
        </div>

        <!-- CTA -->
        <div style="text-align:center;margin-bottom:28px;">
          <a href="https://www.astraterra.ae/buy/apartment" 
             style="display:inline-block;background:linear-gradient(135deg,#C5A265,#8A6F2F);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.5px;">
            Browse Dubai Properties →
          </a>
        </div>

        <p style="margin:0;font-size:14px;color:#374151;line-height:1.8;">
          Have a question or looking for something specific? 
          <a href="https://wa.me/971585580053" style="color:#C5A265;text-decoration:none;font-weight:600;">WhatsApp me directly</a> — 
          I respond personally.
        </p>

        <!-- Signature -->
        <div style="margin-top:32px;padding-top:24px;border-top:1px solid #F3F4F6;">
          <p style="margin:0;font-size:14px;color:#131B2B;font-weight:700;">Joseph Toubia</p>
          <p style="margin:4px 0;font-size:13px;color:#9CA3AF;">Chief Executive Officer, Astraterra Properties</p>
          <p style="margin:4px 0;font-size:12px;color:#9CA3AF;">📍 Oxford Tower, Office 502, Business Bay, Dubai</p>
          <p style="margin:4px 0;font-size:12px;color:#9CA3AF;">🌐 <a href="https://www.astraterra.ae" style="color:#C5A265;text-decoration:none;">astraterra.ae</a> &nbsp;|&nbsp; RERA ORN: 44050</p>
        </div>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#131B2B;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;">
        <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.4);line-height:1.7;">
          You're receiving this because you subscribed at astraterra.ae.<br/>
          <a href="https://www.astraterra.ae" style="color:#C5A265;text-decoration:none;">Visit Website</a> &nbsp;•&nbsp;
          <a href="https://www.astraterra.ae/unsubscribe?email=${encodeURIComponent('{{email}}')}" style="color:rgba(255,255,255,0.4);text-decoration:none;">Unsubscribe</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function campaignEmailHtml({ firstName, subject, bodyHtml, previewText }) {
  const name = firstName || 'there';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#131B2B 0%,#1e2a3d 100%);border-radius:16px 16px 0 0;padding:28px 40px;text-align:center;">
        <div style="font-size:12px;letter-spacing:3px;color:#C5A265;text-transform:uppercase;font-weight:700;margin-bottom:8px;">ASTRATERRA PROPERTIES</div>
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">${subject}</h1>
        ${previewText ? `<p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">${previewText}</p>` : ''}
      </td></tr>

      <!-- Body -->
      <tr><td style="background:#ffffff;padding:40px;">
        <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.8;">Hi ${name},</p>
        <div style="font-size:15px;color:#374151;line-height:1.8;">${bodyHtml}</div>

        <!-- CTA -->
        <div style="text-align:center;margin:32px 0;">
          <a href="https://www.astraterra.ae/buy/apartment"
             style="display:inline-block;background:linear-gradient(135deg,#C5A265,#8A6F2F);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;">
            Browse Properties →
          </a>
        </div>

        <!-- Signature -->
        <div style="margin-top:32px;padding-top:24px;border-top:1px solid #F3F4F6;">
          <p style="margin:0;font-size:14px;color:#131B2B;font-weight:700;">Joseph Toubia</p>
          <p style="margin:4px 0;font-size:13px;color:#9CA3AF;">CEO, Astraterra Properties · RERA ORN 44050</p>
          <p style="margin:4px 0;font-size:12px;"><a href="https://wa.me/971585580053" style="color:#C5A265;text-decoration:none;">📱 WhatsApp</a> &nbsp;|&nbsp; <a href="https://www.astraterra.ae" style="color:#C5A265;text-decoration:none;">🌐 astraterra.ae</a></p>
        </div>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#131B2B;border-radius:0 0 16px 16px;padding:18px 40px;text-align:center;">
        <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.4);">
          <a href="https://www.astraterra.ae" style="color:#C5A265;text-decoration:none;">astraterra.ae</a> &nbsp;•&nbsp;
          <a href="https://www.astraterra.ae/unsubscribe?email={{email}}" style="color:rgba(255,255,255,0.4);text-decoration:none;">Unsubscribe</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES (no auth)
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/email-own/welcome — send welcome email to one address
router.post('/welcome', async (req, res) => {
  const { email, firstName, name } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  const first = firstName || (name ? name.split(' ')[0] : 'there');
  try {
    await sendViaGmail({
      to: email,
      subject: '🏙️ Welcome to the Astraterra Insider — Your Dubai Property Edge',
      html: welcomeEmailHtml(first),
    });
    // Mark welcome sent in subscribers table
    await query(
      `UPDATE newsletter_subscribers SET welcome_sent=1, updated_at=datetime('now') WHERE LOWER(email)=LOWER($1)`,
      [email]
    ).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    console.error('Welcome email error:', err.message);
    res.status(500).json({ error: 'Failed to send welcome email', detail: err.message });
  }
});

// POST /api/email-own/subscribe — subscribe + send welcome (called from website)
router.post('/subscribe', async (req, res) => {
  const { email, name, firstName, phone } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  const first = firstName || (name ? name.split(' ')[0] : '');
  const last  = name ? name.split(' ').slice(1).join(' ') : '';
  const phoneClean = (phone || '').replace(/\s+/g, '').trim();

  try {
    // Upsert into newsletter_subscribers
    const existing = await query(
      `SELECT id, welcome_sent FROM newsletter_subscribers WHERE LOWER(email)=LOWER($1)`,
      [email]
    );

    if (existing.rows.length) {
      // Re-subscribe if unsubscribed
      await query(
        `UPDATE newsletter_subscribers SET status='active', first_name=COALESCE($1,first_name), phone=COALESCE($3,phone), updated_at=datetime('now') WHERE LOWER(email)=LOWER($2)`,
        [first || null, email, phoneClean || null]
      );
    } else {
      await query(
        `INSERT INTO newsletter_subscribers (email, first_name, last_name, phone, source) VALUES ($1,$2,$3,$4,'website')`,
        [email.toLowerCase(), first, last, phoneClean]
      );
    }

    // Send welcome email (always, on any explicit subscribe action)
    sendViaGmail({
      to: email,
      subject: '🏙️ Welcome to the Astraterra Insider — Your Dubai Property Edge',
      html: welcomeEmailHtml(first || 'there'),
    }).then(() => {
      query(`UPDATE newsletter_subscribers SET welcome_sent=1 WHERE LOWER(email)=LOWER($1)`, [email]).catch(() => {});
    }).catch(err => console.error('Welcome email failed:', err.message));

    // Also create CRM contact + lead (with phone if provided)
    fetch('http://localhost:3001/api/leads/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name || email.split('@')[0], email, phone: phoneClean || undefined, source: 'Newsletter Signup', channel: 'website' }),
    }).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    console.error('Subscribe error:', err.message);
    res.status(500).json({ error: 'Subscription failed' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES (auth required)
// ═══════════════════════════════════════════════════════════════════════════════
router.use(auth);

// GET /api/email-own/subscribers — list subscribers
router.get('/subscribers', requireMinRole('admin'), async (req, res) => {
  try {
    const { status = 'active', limit = 100, offset = 0, search = '' } = req.query;
    let sql = `SELECT * FROM newsletter_subscribers WHERE 1=1`;
    const params = [];
    if (status !== 'all') { sql += ` AND status=$${params.length+1}`; params.push(status); }
    if (search) { sql += ` AND (LOWER(email) LIKE $${params.length+1} OR LOWER(first_name) LIKE $${params.length+1})`; params.push(`%${search.toLowerCase()}%`); }
    sql += ` ORDER BY subscribed_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);
    const total = await query(
      `SELECT COUNT(*) as cnt FROM newsletter_subscribers WHERE status=${status === 'all' ? "'active' OR status='unsubscribed'" : `'${status}'`}`
    ).catch(() => ({ rows: [{ cnt: 0 }] }));
    const active = await query(`SELECT COUNT(*) as cnt FROM newsletter_subscribers WHERE status='active'`);
    res.json({ subscribers: result.rows, total: total.rows[0]?.cnt || 0, active: active.rows[0]?.cnt || 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

// POST /api/email-own/subscribers/import — import from contacts table
router.post('/subscribers/import', requireMinRole('admin'), async (req, res) => {
  try {
    const result = await query(`
      INSERT OR IGNORE INTO newsletter_subscribers (email, first_name, source)
      SELECT LOWER(email), name, source
      FROM contacts
      WHERE email IS NOT NULL AND email != '' AND source IN ('Newsletter Signup','newsletter','website','Contact Form')
    `);
    const total = await query(`SELECT COUNT(*) as cnt FROM newsletter_subscribers WHERE status='active'`);
    res.json({ success: true, total: total.rows[0]?.cnt || 0 });
  } catch (err) {
    res.status(500).json({ error: 'Import failed' });
  }
});

// DELETE /api/email-own/subscribers/:id
router.delete('/subscribers/:id', requireMinRole('admin'), async (req, res) => {
  try {
    await query(
      `UPDATE newsletter_subscribers SET status='unsubscribed', unsubscribed_at=datetime('now') WHERE id=$1`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// GET /api/email-own/campaigns
router.get('/campaigns', requireMinRole('admin'), async (req, res) => {
  try {
    const result = await query(`SELECT * FROM email_campaigns ORDER BY created_at DESC LIMIT 50`);
    res.json({ campaigns: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// POST /api/email-own/campaigns — create + optionally send
router.post('/campaigns', requireMinRole('admin'), async (req, res) => {
  try {
    const { subject, preview_text, html_body, text_body, send_now } = req.body;
    if (!subject || !html_body) return res.status(400).json({ error: 'subject and html_body required' });

    const activeCount = await query(`SELECT COUNT(*) as cnt FROM newsletter_subscribers WHERE status='active'`);
    const total = parseInt(activeCount.rows[0]?.cnt) || 0;

    const camp = await query(
      `INSERT INTO email_campaigns (subject, preview_text, html_body, text_body, recipients_count, status, created_by)
       VALUES ($1,$2,$3,$4,$5,'draft',$6) RETURNING *`,
      [subject, preview_text || '', html_body, text_body || '', total, req.user?.id || null]
    );
    const campaign = camp.rows[0];

    if (send_now) {
      // Fire-and-forget bulk send
      sendCampaign(campaign).catch(err => console.error('Campaign send error:', err.message));
      await query(`UPDATE email_campaigns SET status='sending' WHERE id=$1`, [campaign.id]);
      campaign.status = 'sending';
    }

    res.json({ success: true, campaign });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// POST /api/email-own/campaigns/:id/send — send an existing draft
router.post('/campaigns/:id/send', requireMinRole('admin'), async (req, res) => {
  try {
    const camp = await query(`SELECT * FROM email_campaigns WHERE id=$1`, [req.params.id]);
    if (!camp.rows.length) return res.status(404).json({ error: 'Campaign not found' });
    const campaign = camp.rows[0];
    if (campaign.status === 'sent') return res.status(400).json({ error: 'Already sent' });

    await query(`UPDATE email_campaigns SET status='sending' WHERE id=$1`, [campaign.id]);
    sendCampaign(campaign).catch(err => console.error('Campaign send error:', err.message));
    res.json({ success: true, message: 'Sending started — check campaign status for progress' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start send' });
  }
});

// GET /api/email-own/stats
router.get('/stats', requireMinRole('admin'), async (req, res) => {
  try {
    const [active, total, campaigns, sent] = await Promise.all([
      query(`SELECT COUNT(*) as cnt FROM newsletter_subscribers WHERE status='active'`),
      query(`SELECT COUNT(*) as cnt FROM newsletter_subscribers`),
      query(`SELECT COUNT(*) as cnt FROM email_campaigns`),
      query(`SELECT COUNT(*) as cnt FROM email_campaigns WHERE status='sent'`),
    ]);
    res.json({
      active_subscribers: active.rows[0]?.cnt || 0,
      total_subscribers: total.rows[0]?.cnt || 0,
      total_campaigns: campaigns.rows[0]?.cnt || 0,
      sent_campaigns: sent.rows[0]?.cnt || 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// POST /api/email-own/campaigns/preview — generate & return HTML preview (no send)
router.post('/campaigns/preview', requireMinRole('admin'), async (req, res) => {
  try {
    const html = buildAstraterraTemplate({ ...req.body, firstName: 'Valued Investor' });
    res.json({ html });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/email-own/campaigns/send-template — send structured campaign to all active subscribers
router.post('/campaigns/send-template', requireMinRole('admin'), async (req, res) => {
  try {
    const { subject, templateData, html_override } = req.body;
    if (!subject) return res.status(400).json({ error: 'subject required' });

    // Generate HTML from template data, or use designer's manual HTML override
    const baseHtml = html_override || buildAstraterraTemplate(templateData || {});

    const activeCount = await query(`SELECT COUNT(*) as cnt FROM newsletter_subscribers WHERE status='active'`);
    const total = parseInt(activeCount.rows[0]?.cnt) || 0;

    const camp = await query(
      `INSERT INTO email_campaigns (subject, preview_text, html_body, recipients_count, status, created_by)
       VALUES ($1,$2,$3,$4,'sending',$5) RETURNING *`,
      [subject, templateData?.editionLabel || '', baseHtml, total, req.user?.id || null]
    );
    const campaign = camp.rows[0];

    // Fire and forget
    sendCampaign(campaign, baseHtml).catch(err => console.error('Campaign error:', err.message));
    res.json({ success: true, campaign_id: campaign.id, recipients: total, message: `Sending to ${total} subscribers` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Bulk Send Engine ──────────────────────────────────────────────────────────
async function sendCampaign(campaign, htmlOverride = null) {
  const BATCH_SIZE = 20;   // 20 emails per batch
  const DELAY_MS   = 2000; // 2 seconds between batches (~600/hour, safe for Google Workspace)

  const subscribers = await query(
    `SELECT * FROM newsletter_subscribers WHERE status='active'`
  );
  const list = subscribers.rows;
  let sentCount = 0;

  for (let i = 0; i < list.length; i += BATCH_SIZE) {
    const batch = list.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(batch.map(async (sub) => {
      try {
        // Personalize HTML — replace greeting placeholder + unsubscribe email
        const baseHtml = htmlOverride || campaign.html_body;
        const html = baseHtml
          .replace(/Valued Investor/g, sub.first_name || 'Valued Investor')
          .replace(/\{\{email\}\}/g, encodeURIComponent(sub.email))
          .replace(/\{\{contact\.FIRSTNAME \| default:"[^"]*"\}\}/g, sub.first_name || 'Valued Investor');

        await sendViaGmail({ to: sub.email, subject: campaign.subject, html });
        await query(
          `INSERT OR REPLACE INTO email_sends (campaign_id, subscriber_id, email, status, sent_at)
           VALUES ($1,$2,$3,'sent',datetime('now'))`,
          [campaign.id, sub.id, sub.email]
        );
        sentCount++;
      } catch (err) {
        await query(
          `INSERT OR REPLACE INTO email_sends (campaign_id, subscriber_id, email, status, error)
           VALUES ($1,$2,$3,'failed',$4)`,
          [campaign.id, sub.id, sub.email, err.message]
        ).catch(() => {});
      }
    }));

    await query(`UPDATE email_campaigns SET sent_count=$1 WHERE id=$2`, [sentCount, campaign.id]);

    if (i + BATCH_SIZE < list.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  await query(
    `UPDATE email_campaigns SET status='sent', sent_at=datetime('now'), sent_count=$1 WHERE id=$2`,
    [sentCount, campaign.id]
  );
  console.log(`✅ Campaign "${campaign.subject}" sent to ${sentCount}/${list.length} subscribers`);
}

module.exports = router;
