/**
 * Email Integration Route — Astraterra CRM
 * - NodeMailer for transactional emails via Gmail SMTP
 * - Brevo (Sendinblue) for email marketing campaigns
 */

const express = require('express');
const router = express.Router();
const https = require('https');
const { authenticateToken: auth, requireMinRole } = require("../middleware/auth");

// ─── Brevo API Configuration ───────────────────────────────────────────────
const BREVO_API_KEY = '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';
const BREVO_BASE = 'api.brevo.com';

function brevoRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: BREVO_BASE,
      port: 443,
      path: `/v3${path}`,
      method,
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };
    if (postData) options.headers['Content-Length'] = Buffer.byteLength(postData);
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`Brevo API error ${res.statusCode}: ${JSON.stringify(parsed)}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse Brevo response: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// ─── Gmail OAuth2 Credentials ──────────────────────────────────────────────
const GMAIL_CLIENT_ID     = '755978414447-dsptstqakm3jna7li6fm5hnlmr7ogv5m.apps.googleusercontent.com';
const GMAIL_CLIENT_SECRET = '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';
const GMAIL_REFRESH_TOKEN = '1//0gxC7sM6PDgb3CgYIARAAGBASNwF-L9IrUGzadEquKq6GV6dpyD5WnhLZ2ZvwWZrq2-6BFaZrAwxlRWhooC6XLvHXpgNIFTNK24A';
const GMAIL_USER          = 'admin@astraterra.ae';

// ─── Gmail API (for inbox reading) ─────────────────────────────────────────
const { google } = require('googleapis');
const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, 'http://localhost');
oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
const gmailApi = google.gmail({ version: 'v1', auth: oauth2Client });

// ─── Send via Gmail API (replaces SMTP — no App Password needed) ───────────
async function sendViaGmail({ to, subject, text, html, replyTo }) {
  const fromHeader = `"Astraterra Properties" <${GMAIL_USER}>`;
  const toHeader   = Array.isArray(to) ? to.join(', ') : to;
  const boundary   = `boundary_${Date.now()}`;

  let rawMessage;
  if (html) {
    rawMessage = [
      `From: ${fromHeader}`,
      `To: ${toHeader}`,
      `Subject: ${subject}`,
      replyTo ? `Reply-To: ${replyTo}` : '',
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
    ].filter(l => l !== undefined).join('\r\n');
  } else {
    rawMessage = [
      `From: ${fromHeader}`,
      `To: ${toHeader}`,
      `Subject: ${subject}`,
      replyTo ? `Reply-To: ${replyTo}` : '',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      text || '',
    ].filter(l => l !== undefined).join('\r\n');
  }

  const encoded = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const result = await gmailApi.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded },
  });

  return { messageId: result.data.id };
}

// ═══════════════════════════════════════════════════════════════════════════
// BREVO EMAIL MARKETING ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/email/campaigns — Fetch all email campaigns from Brevo
router.get('/campaigns', auth, requireMinRole('marketing'), async (req, res) => {
  try {
    const limit = req.query.limit || 20;
    const status = req.query.status || 'sent';
    const data = await brevoRequest('GET', `/emailCampaigns?status=${status}&limit=${limit}&sort=desc`);
    res.json({ success: true, campaigns: data.campaigns || [], count: data.count || 0 });
  } catch (err) {
    console.error('Brevo campaigns error:', err.message);
    // Return empty on error so UI doesn't break
    res.json({ success: false, campaigns: [], error: err.message });
  }
});

// GET /api/email/campaigns/all — Fetch sent + draft campaigns
router.get('/campaigns/all', auth, requireMinRole('marketing'), async (req, res) => {
  try {
    const [sent, draft] = await Promise.all([
      brevoRequest('GET', '/emailCampaigns?status=sent&limit=20&sort=desc').catch(() => ({ campaigns: [] })),
      brevoRequest('GET', '/emailCampaigns?status=draft&limit=10&sort=desc').catch(() => ({ campaigns: [] })),
    ]);
    const all = [
      ...(sent.campaigns || []).map(c => ({ ...c, statusLabel: 'sent' })),
      ...(draft.campaigns || []).map(c => ({ ...c, statusLabel: 'draft' })),
    ];
    res.json({ success: true, campaigns: all });
  } catch (err) {
    res.json({ success: false, campaigns: [], error: err.message });
  }
});

// GET /api/email/templates — Fetch email templates from Brevo
router.get('/templates', auth, requireMinRole('marketing'), async (req, res) => {
  try {
    const data = await brevoRequest('GET', '/smtp/templates?templateStatus=true&limit=50');
    res.json({ success: true, templates: data.templates || [] });
  } catch (err) {
    console.error('Brevo templates error:', err.message);
    res.json({ success: false, templates: [], error: err.message });
  }
});

// GET /api/email/lists — Fetch contact lists from Brevo
router.get('/lists', auth, requireMinRole('marketing'), async (req, res) => {
  try {
    const data = await brevoRequest('GET', '/contacts/lists?limit=50');
    res.json({ success: true, lists: data.lists || [] });
  } catch (err) {
    console.error('Brevo lists error:', err.message);
    res.json({ success: false, lists: [], error: err.message });
  }
});

// GET /api/email/stats — Aggregate stats from recent campaigns
router.get('/stats', auth, requireMinRole('marketing'), async (req, res) => {
  try {
    const data = await brevoRequest('GET', '/emailCampaigns?status=sent&limit=10&sort=desc');
    const campaigns = data.campaigns || [];
    let totalSent = 0, totalOpened = 0, totalClicked = 0, totalUnsubscribed = 0;
    campaigns.forEach(c => {
      const stats = c.statistics?.campaignStats?.[0] || {};
      totalSent += stats.delivered || 0;
      totalOpened += stats.uniqueViews || 0;
      totalClicked += stats.uniqueClicks || 0;
      totalUnsubscribed += stats.unsubscriptions || 0;
    });
    const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : 0;
    const clickRate = totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(1) : 0;
    res.json({
      success: true,
      stats: {
        totalSent,
        totalOpened,
        totalClicked,
        totalUnsubscribed,
        openRate: parseFloat(openRate),
        clickRate: parseFloat(clickRate),
        campaignCount: campaigns.length,
        lastCampaign: campaigns[0]?.name || null,
        lastCampaignDate: campaigns[0]?.sentDate || null,
      }
    });
  } catch (err) {
    res.json({ success: false, stats: {}, error: err.message });
  }
});

// POST /api/email/campaign/create — Create a campaign in Brevo (draft)
router.post('/campaign/create', auth, requireMinRole('marketing'), async (req, res) => {
  const { name, subject, senderName, senderEmail, listIds, templateId, htmlContent } = req.body;
  if (!name || !subject) {
    return res.status(400).json({ error: 'name and subject are required' });
  }
  try {
    const payload = {
      name: name || `Astraterra Campaign - ${new Date().toLocaleDateString()}`,
      subject,
      sender: { name: senderName || 'Astraterra Properties', email: senderEmail || 'admin@astraterra.ae' },
      type: 'classic',
      recipients: { listIds: listIds || [3] },
    };
    if (templateId) payload.templateId = parseInt(templateId);
    else if (htmlContent) payload.htmlContent = htmlContent;
    else payload.htmlContent = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#131B2B;color:#fff;border-radius:12px;"><div style="text-align:center;margin-bottom:24px;"><h1 style="color:#C9A96E;font-size:28px;">${name}</h1></div><div style="background:#1a2438;padding:24px;border-radius:8px;border:1px solid rgba(201,169,110,0.3);"><p style="font-size:16px;line-height:1.6;">${subject}</p></div><div style="text-align:center;margin-top:24px;"><a href="https://astraterra.ae" style="background:linear-gradient(135deg,#C9A96E,#8A6F2F);color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Visit Astraterra</a></div></div>`;

    const result = await brevoRequest('POST', '/emailCampaigns', payload);
    res.json({ success: true, campaignId: result.id, message: 'Campaign created' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create campaign', detail: err.message });
  }
});

// POST /api/email/campaign/send — Send a created campaign immediately
router.post('/campaign/send', auth, requireMinRole('marketing'), async (req, res) => {
  const { campaignId } = req.body;
  if (!campaignId) return res.status(400).json({ error: 'campaignId is required' });
  try {
    await brevoRequest('POST', `/emailCampaigns/${campaignId}/sendNow`, {});
    res.json({ success: true, message: `Campaign ${campaignId} sent` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send campaign', detail: err.message });
  }
});

// POST /api/email/campaign/schedule — Schedule a campaign
router.post('/campaign/schedule', auth, requireMinRole('marketing'), async (req, res) => {
  const { campaignId, scheduledAt } = req.body;
  if (!campaignId || !scheduledAt) return res.status(400).json({ error: 'campaignId and scheduledAt required' });
  try {
    await brevoRequest('POST', `/emailCampaigns/${campaignId}/sendAtBestTime`, { scheduledAt });
    res.json({ success: true, message: `Campaign ${campaignId} scheduled for ${scheduledAt}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to schedule campaign', detail: err.message });
  }
});

// POST /api/email/campaign/send-full — Create + send in one step
router.post('/campaign/send-full', auth, requireMinRole('marketing'), async (req, res) => {
  const { name, subject, senderName, senderEmail, listIds, templateId, htmlContent, scheduledAt } = req.body;
  if (!name || !subject) {
    return res.status(400).json({ error: 'name and subject are required' });
  }
  try {
    // Step 1: Create campaign
    const payload = {
      name,
      subject,
      sender: { name: senderName || 'Astraterra Properties', email: senderEmail || 'admin@astraterra.ae' },
      type: 'classic',
      recipients: { listIds: listIds || [3] },
    };
    if (templateId) payload.templateId = parseInt(templateId);
    else if (htmlContent) payload.htmlContent = htmlContent;
    else payload.htmlContent = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">${subject}</div>`;

    const created = await brevoRequest('POST', '/emailCampaigns', payload);
    const campaignId = created.id;

    // Step 2: Send or schedule
    if (scheduledAt) {
      await brevoRequest('POST', `/emailCampaigns/${campaignId}/sendAtBestTime`, { scheduledAt });
      res.json({ success: true, campaignId, message: `Campaign created and scheduled for ${scheduledAt}` });
    } else {
      await brevoRequest('POST', `/emailCampaigns/${campaignId}/sendNow`, {});
      res.json({ success: true, campaignId, message: 'Campaign created and sent immediately' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to create/send campaign', detail: err.message });
  }
});

// POST /api/email/transactional — Send transactional email to a single contact
router.post('/transactional', auth, requireMinRole('marketing'), async (req, res) => {
  const { to, toName, subject, htmlContent, templateId, params } = req.body;
  if (!to || !subject) return res.status(400).json({ error: 'to and subject are required' });
  try {
    const payload = {
      sender: { name: 'Astraterra Properties', email: 'admin@astraterra.ae' },
      to: [{ email: to, name: toName || to }],
      subject,
    };
    if (templateId) {
      payload.templateId = parseInt(templateId);
      if (params) payload.params = params;
    } else {
      payload.htmlContent = htmlContent || `<div style="font-family:Arial,sans-serif;">${subject}</div>`;
    }
    const result = await brevoRequest('POST', '/smtp/email', payload);
    res.json({ success: true, messageId: result.messageId, message: 'Transactional email sent' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send transactional email', detail: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY / NODEMAILER ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/email/send — Send an email via Gmail SMTP
router.post('/send', auth, requireMinRole('marketing'), async (req, res) => {
  const { to, subject, body, html, replyTo } = req.body;

  if (!to || !subject || (!body && !html)) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, body' });
  }

  try {
    const info = await sendViaGmail({
      to,
      subject,
      text: body,
      html: html || `<div style="font-family: Arial, sans-serif;">${body.replace(/\n/g, '<br>')}</div>`,
      replyTo: replyTo || 'admin@astraterra.ae',
    });

    res.json({ success: true, messageId: info.messageId, message: 'Email sent successfully' });
  } catch (err) {
    console.error('Email send error:', err.message);
    res.status(500).json({ error: 'Failed to send email', detail: err.message });
  }
});

// POST /api/email/send-template — Send a templated email
router.post('/send-template', auth, requireMinRole('marketing'), async (req, res) => {
  const { to, template, data } = req.body;

  const templates = {
    welcome: {
      subject: 'Welcome to Astraterra Properties!',
      html: (d) => `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#131B2B;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#C9A96E,#8A6F2F);padding:32px;text-align:center;">
            <h1 style="color:white;margin:0;font-size:24px;">Welcome, ${d.name}! 🌟</h1>
          </div>
          <div style="padding:32px;color:#fff;">
            <p>Thank you for reaching out to Astraterra Properties. We are here to help you find your perfect property in Dubai.</p>
            <div style="margin:24px 0;padding:16px;background:#1a2438;border-radius:8px;border-left:4px solid #C9A96E;">
              <p style="margin:0;color:#C9A96E;font-weight:bold;">Your dedicated agent will contact you within 24 hours.</p>
            </div>
            <p style="color:rgba(255,255,255,0.6);">📞 +971 4 570 3846 | 💬 WhatsApp: +971 58 558 0053</p>
            <p style="color:rgba(255,255,255,0.6);">📍 Oxford Tower, Office 502, Business Bay, Dubai</p>
          </div>
        </div>
      `,
    },
    viewing_confirmation: {
      subject: 'Viewing Confirmed — Astraterra Properties',
      html: (d) => `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#131B2B;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#C9A96E,#8A6F2F);padding:32px;text-align:center;">
            <h1 style="color:white;margin:0;font-size:24px;">Viewing Confirmed ✅</h1>
          </div>
          <div style="padding:32px;color:#fff;">
            <p>Dear ${d.name},</p>
            <p>Your property viewing has been confirmed.</p>
            <div style="margin:24px 0;padding:16px;background:#1a2438;border-radius:8px;border:1px solid rgba(201,169,110,0.3);">
              <p style="margin:0 0 8px;font-weight:bold;color:#C9A96E;">🏠 Property: ${d.property || 'TBD'}</p>
              <p style="margin:0 0 8px;">📅 Date: ${d.date || 'TBD'}</p>
              <p style="margin:0;">⏰ Time: ${d.time || 'TBD'}</p>
            </div>
            <p style="color:rgba(255,255,255,0.6);">📞 +971 4 570 3846 | 💬 <a href="https://wa.me/971585580053" style="color:#C9A96E;">WhatsApp</a></p>
          </div>
        </div>
      `,
    },
    follow_up: {
      subject: 'Following Up — Astraterra Properties',
      html: (d) => `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#131B2B;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#C9A96E,#8A6F2F);padding:32px;text-align:center;">
            <h1 style="color:white;margin:0;font-size:24px;">Hello, ${d.name}! 👋</h1>
          </div>
          <div style="padding:32px;color:#fff;">
            <p>${d.message || 'We wanted to follow up on your property search.'}</p>
            <p>We have new listings that might interest you based on your preferences.</p>
            <div style="margin:24px 0;text-align:center;">
              <a href="https://wa.me/971585580053" style="background:#25d366;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">💬 Chat on WhatsApp</a>
            </div>
            <p style="color:rgba(255,255,255,0.6);">📞 +971 4 570 3846 | 📧 admin@astraterra.ae</p>
          </div>
        </div>
      `,
    },
  };

  const tmpl = templates[template];
  if (!tmpl) {
    return res.status(400).json({ error: 'Unknown template. Available: welcome, viewing_confirmation, follow_up' });
  }

  try {
    const info = await sendViaGmail({
      to,
      subject: tmpl.subject,
      html: tmpl.html(data || {}),
    });

    res.json({ success: true, messageId: info.messageId, template, message: 'Template email sent' });
  } catch (err) {
    console.error('Template email error:', err.message);
    res.status(500).json({ error: 'Failed to send template email', detail: err.message });
  }
});

// GET /api/email/test — Test Gmail API connection
router.get('/test', auth, requireMinRole('marketing'), async (req, res) => {
  try {
    // Verify by fetching Gmail profile — confirms OAuth2 is working
    const profile = await gmailApi.users.getProfile({ userId: 'me' });
    res.json({
      success: true,
      message: `Gmail API connected — ${profile.data.emailAddress} (${profile.data.messagesTotal} messages)`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GMAIL INBOX → AUTO LEAD CREATION
// ═══════════════════════════════════════════════════════════════════════════

const { query: dbQuery } = require('../config/database');

function extractEmail(from) {
  const match = from.match(/<([^>]+)>/) || from.match(/([^\s]+@[^\s]+)/);
  return match ? match[1].toLowerCase().trim() : from.toLowerCase().trim();
}

function extractName(from) {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : '';
}

function decodeBase64(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function extractBody(payload) {
  if (!payload) return '';
  if (payload.body && payload.body.data) return decodeBase64(payload.body.data);
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data)
        return decodeBase64(part.body.data);
    }
    for (const part of payload.parts) {
      const sub = extractBody(part);
      if (sub) return sub;
    }
  }
  return '';
}

// GET /api/email/inbox/sync — Read unread Gmail messages and add senders as leads
router.get('/inbox/sync', auth, requireMinRole('marketing'), async (req, res) => {
  try {
    const maxResults = parseInt(req.query.limit) || 20;

    // Fetch unread emails in INBOX
    const listRes = await gmailApi.users.messages.list({
      userId: 'me',
      q: 'is:unread in:inbox',
      maxResults,
    });

    const messages = listRes.data.messages || [];
    if (!messages.length) {
      return res.json({ success: true, processed: 0, leads_added: 0, message: 'No unread emails.' });
    }

    let leadsAdded = 0;
    let leadsSkipped = 0;
    const results = [];

    for (const msg of messages) {
      try {
        const full = await gmailApi.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full',
        });

        const headers = {};
        (full.data.payload?.headers || []).forEach(h => {
          headers[h.name.toLowerCase()] = h.value;
        });

        const from     = headers['from'] || '';
        const subject  = headers['subject'] || '(no subject)';
        const date     = headers['date'] || '';
        const email    = extractEmail(from);
        const name     = extractName(from) || email.split('@')[0];
        const snippet  = full.data.snippet || '';

        // Skip automated / bulk / system senders
        const skipDomains = [
          'metricool.com', 'brevo.com', 'sendinblue.com', 'mailchimp.com',
          'microsoft.com', 'infomail.microsoft.com', 'google.com', 'googlemail.com',
          'linkedin.com', 'facebook.com', 'instagram.com', 'twitter.com',
          'notifications.google.com', 'accounts.google.com',
          'amazonses.com', 'sendgrid.net', 'sparkpost.com', 'mailgun.org',
        ];
        const skipPatterns = [
          'noreply', 'no-reply', 'mailer-daemon', 'notifications@',
          'newsletter', 'donotreply', 'do-not-reply', 'bounce',
          'support@', 'hello@', 'info@metricool', 'welcome@',
          'postmaster', 'autoresponder',
        ];
        const emailDomain = email.split('@')[1] || '';
        const isAutomated = skipDomains.some(d => emailDomain === d || emailDomain.endsWith('.' + d)) ||
                            skipPatterns.some(p => email.includes(p)) ||
                            email.endsWith('@astraterra.ae');
        if (isAutomated) {
          leadsSkipped++;
          continue;
        }

        // Check if contact already exists
        const existingRes = await dbQuery('SELECT id FROM contacts WHERE email = $1', [email]);
        if (existingRes.rows.length > 0) {
          leadsSkipped++;
          results.push({ email, status: 'already_exists', id: existingRes.rows[0].id });
          continue;
        }

        // Insert new contact as lead
        const insertRes = await dbQuery(
          `INSERT INTO contacts (name, email, type, status, notes, created_at, updated_at)
           VALUES ($1, $2, 'Lead', 'New', $3, datetime('now'), datetime('now')) RETURNING id`,
          [
            name,
            email,
            `Auto-added from Gmail inbox.\nSubject: ${subject}\nDate: ${date}\nSnippet: ${snippet.substring(0, 300)}`,
          ]
        );

        const newId = insertRes.rows[0]?.id;
        leadsAdded++;
        results.push({ email, name, status: 'added', id: newId, subject });

        // Mark email as read
        await gmailApi.users.messages.modify({
          userId: 'me',
          id: msg.id,
          requestBody: { removeLabelIds: ['UNREAD'] },
        });

      } catch (msgErr) {
        results.push({ id: msg.id, status: 'error', error: msgErr.message });
      }
    }

    res.json({
      success: true,
      processed: messages.length,
      leads_added: leadsAdded,
      leads_skipped: leadsSkipped,
      results,
    });

  } catch (err) {
    console.error('Gmail inbox sync error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/email/inbox/preview — Preview unread emails without adding leads
router.get('/inbox/preview', auth, requireMinRole('marketing'), async (req, res) => {
  try {
    const listRes = await gmailApi.users.messages.list({
      userId: 'me',
      q: 'is:unread in:inbox',
      maxResults: 10,
    });

    const messages = listRes.data.messages || [];
    const previews = [];

    for (const msg of messages) {
      const full = await gmailApi.users.messages.get({
        userId: 'me', id: msg.id, format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      });
      const headers = {};
      (full.data.payload?.headers || []).forEach(h => { headers[h.name.toLowerCase()] = h.value; });
      previews.push({
        id: msg.id,
        from: headers['from'] || '',
        subject: headers['subject'] || '',
        date: headers['date'] || '',
        snippet: full.data.snippet || '',
      });
    }

    res.json({ success: true, count: previews.length, emails: previews });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
