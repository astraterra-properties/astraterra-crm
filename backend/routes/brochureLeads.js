/**
 * Brochure Leads Route — PUBLIC (no auth required for POST)
 * Captures lead details before allowing brochure download
 * Saves to both brochure_leads table AND main leads pipeline
 * Sends WhatsApp notification to Joseph on every new download
 */
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

const { execSync } = require('child_process');

// Send WhatsApp notification to Joseph via OpenClaw CLI
function notifyJoseph(lead) {
  const msg = `🏠 *New Brochure Download — Lead Alert!*\n\n` +
    `👤 *Name:* ${lead.name}\n` +
    `📱 *Phone:* ${lead.phone}\n` +
    `📧 *Email:* ${lead.email}\n` +
    `🏗️ *Project:* ${lead.projectName || 'Unknown'}\n\n` +
    `💡 They downloaded the brochure — follow up now while they're interested!\n\n` +
    `📊 View pipeline: https://crm.astraterra.ae/leads`;

  // Fire-and-forget via OpenClaw CLI
  setImmediate(() => {
    try {
      execSync(
        `openclaw message send --channel whatsapp --target "+971585580053" --message ${JSON.stringify(msg)}`,
        { timeout: 10000, stdio: 'ignore' }
      );
    } catch {
      // silent fail — notification is non-critical, lead is already saved
    }
  });
}

// POST /api/brochure-leads — save a lead, no auth required
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, projectName, projectSlug, brochureUrl } = req.body;

    // Basic validation
    if (!name || !phone || !email) {
      return res.status(400).json({ error: 'Name, phone, and email are required' });
    }

    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';

    // Save to brochure_leads table (for history)
    await query(
      `INSERT INTO brochure_leads (name, phone, email, project_name, project_slug, brochure_url, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, phone, email, projectName || '', projectSlug || '', brochureUrl || '', String(ip).slice(0, 100)]
    );

    // ALSO save to main leads pipeline
    const notes = projectName
      ? `Off-plan brochure download — ${projectName}${projectSlug ? ' (/' + projectSlug + ')' : ''}`
      : 'Off-plan brochure download from website';
    await query(
      `INSERT INTO leads (name, email, phone, source, status, priority, notes)
       VALUES (?, ?, ?, 'website', 'new', 'high', ?)`,
      [name, email || '', phone, notes]
    );

    // Send WhatsApp notification to Joseph (fire-and-forget)
    const lead = { name, phone, email, projectName, projectSlug };
    notifyJoseph(lead);

    res.json({ success: true });
  } catch (err) {
    console.error('Brochure lead error:', err.message);
    res.status(500).json({ error: 'Failed to save lead' });
  }
});

// GET /api/brochure-leads — list all leads (requires auth — for CRM internal use)
const { authenticateToken: auth } = require('../middleware/auth');
router.get('/', auth, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM brochure_leads ORDER BY created_at DESC LIMIT 500',
      []
    );
    res.json({ success: true, leads: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
