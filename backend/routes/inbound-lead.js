/**
 * Public inbound lead webhook handler
 * No authentication required — for external websites and portals
 * Registered at: POST /api/leads/inbound
 */

const { query } = require('../config/database');
const { chromium } = require('playwright');
const { triggerLeadSync } = require('../services/paperclip-sync');

const ADMIN_GMAIL = 'admin@astraterra.ae';
const ADMIN_GMAIL_PASSWORD = 'Astraterra@2026!';
const JOSEPH_NOTIFY_EMAIL = 'joseph@astraterra.ae';

function buildWelcomeEmail(name = '') {
  const first = (name || '').trim().split(/\s+/)[0] || 'there';
  return {
    subject: 'Welcome to Astraterra Properties',
    body: `Hi ${first},\n\nThank you for subscribing to Astraterra Properties. I wanted to personally introduce ourselves and welcome you.\n\nWe help clients across Dubai with buying, selling, renting, off-plan opportunities, and investment guidance. If you are currently exploring the market, we would be happy to support you with tailored options based on your goals and budget.\n\nIf you would like, just reply to this email with what you are looking for, such as:\n- buying or renting\n- preferred area in Dubai\n- budget range\n- number of bedrooms\n- whether this is for end use or investment\n\nOnce we have that, we can send you a more relevant shortlist and next steps.\n\nBest regards,\nJoseph Toubia\nCEO, Astraterra Properties\nwww.astraterra.ae\n+971 58 558 0053`
  };
}

function buildJosephNotification({ name, email, phone, source }) {
  return {
    subject: `New newsletter lead: ${name || email || phone || 'New Lead'}`,
    body: `Hi Joseph,\n\nA new lead has come in and the standard welcome email has been sent automatically.\n\nLead details:\n- Name: ${name || 'Not provided'}\n- Email: ${email || 'Not provided'}\n- Phone: ${phone || 'Not provided'}\n- Source: ${source || 'Website'}\n\nPlease follow up personally when you can.\n\nBest,\nIsabelle`
  };
}

async function sendEmailViaGmailUi({ to, subject, body }) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    await page.goto('https://accounts.google.com/signin/v2/identifier?service=mail', { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"]', ADMIN_GMAIL);
    await page.click('#identifierNext');
    await page.waitForSelector('input[type="password"]', { timeout: 20000 });
    await page.fill('input[type="password"]', ADMIN_GMAIL_PASSWORD);
    await page.click('#passwordNext');
    await page.waitForTimeout(10000);
    await page.goto('https://mail.google.com/mail/u/0/?view=cm&fs=1&tf=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[aria-label="To recipients"]', { timeout: 30000 });
    await page.fill('input[aria-label="To recipients"]', to);
    await page.fill('input[name="subjectbox"]', subject);
    await page.locator('div[aria-label="Message Body"]').fill(body);
    await page.click('div[role="button"][data-tooltip^="Send"]');
    await page.waitForTimeout(4000);
    const text = await page.locator('body').innerText();
    if (!text.includes('Message sent')) {
      throw new Error('Gmail UI send did not confirm message sent');
    }
  } finally {
    await browser.close();
  }
}

module.exports = async (req, res) => {
  try {
    const {
      name, phone, email, source, message,
      property_type, propertyType,
      budget, budget_min, budget_max,
      location, location_preference,
      bedrooms, purpose, timeline,
      lead_type, type,
      source_details, inquiry_type,
      must_haves, nice_to_haves,
      channel = 'webhook',
    } = req.body;

    const cleanName = (name || '').trim();
    const cleanPhone = (phone || '').trim();
    const cleanEmail = (email || '').trim();
    const cleanSource = (source || channel || 'website').trim();
    const normalizedPropertyType = (property_type || propertyType || '').trim();
    const normalizedLocation = (location_preference || location || '').trim();
    const normalizedBedrooms = `${bedrooms || ''}`.trim();
    const normalizedPurpose = `${purpose || ''}`.trim();
    const normalizedTimeline = `${timeline || ''}`.trim();
    const normalizedSourceDetails = `${source_details || inquiry_type || ''}`.trim();
    const normalizedMustHaves = Array.isArray(must_haves) ? must_haves.join(', ') : `${must_haves || ''}`.trim();
    const normalizedNiceToHaves = Array.isArray(nice_to_haves) ? nice_to_haves.join(', ') : `${nice_to_haves || ''}`.trim();

    const numericBudget = Number(String(budget || '').replace(/[^\d.]/g, '')) || null;
    const numericBudgetMin = Number(String(budget_min || '').replace(/[^\d.]/g, '')) || null;
    const numericBudgetMax = Number(String(budget_max || '').replace(/[^\d.]/g, '')) || null;

    const inferLeadType = () => {
      const explicit = `${lead_type || type || ''}`.trim().toLowerCase();
      if (explicit) return explicit;
      const sourceHint = `${cleanSource} ${normalizedSourceDetails}`.toLowerCase();
      const purposeHint = normalizedPurpose.toLowerCase();
      if (sourceHint.includes('newsletter')) return 'investor';
      if (sourceHint.includes('valuation')) return 'seller';
      if (sourceHint.includes('list property')) return purposeHint === 'rent' ? 'landlord' : 'seller';
      if (sourceHint.includes('rent')) return 'tenant';
      return 'buyer';
    };

    const normalizedLeadType = inferLeadType();

    const structuredDetails = [
      normalizedPropertyType && `Property Type: ${normalizedPropertyType}`,
      normalizedLocation && `Location: ${normalizedLocation}`,
      normalizedBedrooms && `Bedrooms: ${normalizedBedrooms}`,
      normalizedPurpose && `Purpose: ${normalizedPurpose}`,
      numericBudgetMin && `Budget Min: AED ${numericBudgetMin.toLocaleString('en-AE')}`,
      numericBudgetMax && `Budget Max: AED ${numericBudgetMax.toLocaleString('en-AE')}`,
      !numericBudgetMin && !numericBudgetMax && numericBudget && `Budget: AED ${numericBudget.toLocaleString('en-AE')}`,
      normalizedTimeline && `Timeline: ${normalizedTimeline}`,
      normalizedMustHaves && `Must-Haves: ${normalizedMustHaves}`,
      normalizedNiceToHaves && `Nice-to-Haves: ${normalizedNiceToHaves}`,
      normalizedSourceDetails && `Source Details: ${normalizedSourceDetails}`,
    ].filter(Boolean);

    const cleanMessage = [
      (message || '').trim(),
      structuredDetails.length ? `--- Lead Details ---\n${structuredDetails.join('\n')}` : '',
    ].filter(Boolean).join('\n\n');

    if (!cleanPhone && !cleanEmail) {
      return res.status(400).json({ error: 'phone or email required' });
    }

    // Create or find contact
    let contact;
    const searchField = cleanPhone ? 'phone' : 'email';
    const searchValue = cleanPhone || cleanEmail;

    const existing = await query(
      `SELECT * FROM contacts WHERE ${searchField} = ? LIMIT 1`,
      [searchValue]
    );

    if (existing.rows && existing.rows.length > 0) {
      contact = existing.rows[0];

      const shouldUpdateContact = (
        ((!(contact.name || '').trim()) || (contact.name || '').trim() === 'Unknown') && cleanName
      ) || (
        !(contact.phone || '').trim() && cleanPhone
      ) || (
        !(contact.email || '').trim() && cleanEmail
      ) || (
        !(contact.source || '').trim() && cleanSource
      ) || (
        !(contact.notes || '').trim() && cleanMessage
      ) || (
        !(contact.property_type || '').trim() && normalizedPropertyType
      ) || (
        !(contact.location_preference || '').trim() && normalizedLocation
      ) || (
        !(contact.bedrooms || '').trim() && normalizedBedrooms
      ) || (
        !(contact.purpose || '').trim() && normalizedPurpose
      ) || (
        !(contact.timeline || '').trim() && normalizedTimeline
      ) || (
        !contact.budget_min && (numericBudgetMin || numericBudget)
      ) || (
        !contact.budget_max && (numericBudgetMax || numericBudget)
      ) || (
        !(contact.source_details || '').trim() && normalizedSourceDetails
      ) || (
        !(contact.type || '').trim() && normalizedLeadType
      );

      if (shouldUpdateContact) {
        const updated = await query(`
          UPDATE contacts
          SET name = ?,
              phone = ?,
              email = ?,
              type = ?,
              source = ?,
              source_details = ?,
              notes = ?,
              property_type = ?,
              location_preference = ?,
              bedrooms = ?,
              purpose = ?,
              timeline = ?,
              budget_min = ?,
              budget_max = ?,
              must_haves = ?,
              nice_to_haves = ?
          WHERE id = ?
          RETURNING *
        `, [
          cleanName || contact.name || 'Unknown',
          cleanPhone || contact.phone || null,
          cleanEmail || contact.email || null,
          normalizedLeadType || contact.type || 'buyer',
          cleanSource || contact.source || channel,
          normalizedSourceDetails || contact.source_details || null,
          cleanMessage || contact.notes || '',
          normalizedPropertyType || contact.property_type || null,
          normalizedLocation || contact.location_preference || null,
          normalizedBedrooms || contact.bedrooms || null,
          normalizedPurpose || contact.purpose || null,
          normalizedTimeline || contact.timeline || null,
          numericBudgetMin || numericBudget || contact.budget_min || null,
          numericBudgetMax || numericBudget || contact.budget_max || null,
          normalizedMustHaves || contact.must_haves || null,
          normalizedNiceToHaves || contact.nice_to_haves || null,
          contact.id,
        ]);

        contact = updated.rows[0] || contact;
      }
    } else {
      const newContact = await query(`
        INSERT INTO contacts (
          name, phone, email, type, source, source_details, notes,
          property_type, location_preference, bedrooms, purpose, timeline,
          budget_min, budget_max, must_haves, nice_to_haves
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
      `, [
        cleanName || 'Unknown',
        cleanPhone || null,
        cleanEmail || null,
        normalizedLeadType || 'buyer',
        cleanSource,
        normalizedSourceDetails || null,
        cleanMessage || '',
        normalizedPropertyType || null,
        normalizedLocation || null,
        normalizedBedrooms || null,
        normalizedPurpose || null,
        normalizedTimeline || null,
        numericBudgetMin || numericBudget || null,
        numericBudgetMax || numericBudget || null,
        normalizedMustHaves || null,
        normalizedNiceToHaves || null,
      ]);
      contact = newContact.rows[0];
    }

    // Create lead
    const lead = await query(`
      INSERT INTO leads (contact_id, status, priority, source, notes, pipeline_stage, source_channel, lead_type, name, phone, email)
      VALUES (?, 'not_contacted', 'medium', ?, ?, 'new_lead', ?, ?, ?, ?, ?)
      RETURNING *
    `, [
      contact.id,
      cleanSource,
      cleanMessage || '',
      channel,
      normalizedLeadType,
      cleanName || contact.name || 'Unknown',
      cleanPhone || contact.phone || null,
      cleanEmail || contact.email || null,
    ]);

    const leadId = lead.rows?.[0]?.id;

    // Log activity
    query(`
      INSERT INTO lead_activity (contact_id, lead_id, channel, activity_type, description, metadata)
      VALUES (?, ?, ?, 'inbound_lead', ?, ?)
    `, [contact.id, leadId, channel, `New inbound lead from ${cleanSource || channel}`, JSON.stringify(req.body)]).catch(() => {});

    const sourceLabel = cleanSource || channel || 'Website';
    const isWebsiteLead = channel === 'website'
      || /website|contact form|newsletter|valuation|list property|rent enquiry|rera calculator|find my property|astraestimate/i.test(sourceLabel);
    const isNewsletterLead = /newsletter/i.test(sourceLabel);

    if (isWebsiteLead) {
      // Increment website portal counter
      query(`
        UPDATE portal_integrations
        SET leads_synced = leads_synced + 1,
            last_sync = datetime('now'),
            status = 'connected',
            updated_at = datetime('now')
        WHERE LOWER(portal_name) = 'website'
      `).catch(() => {});

      // Create notification
      const displayName = cleanName || cleanEmail || cleanPhone || 'Unknown';
      query(`
        INSERT INTO notifications (type, icon, title, body, link, meta, is_read)
        VALUES ('lead', '🌐', ?, ?, '/pipeline', ?, 0)
      `, [
        `New lead from ${sourceLabel}`,
        `${displayName} just signed up via your website${message ? ` — "${message.substring(0, 80)}..."` : ''}`,
        JSON.stringify({ contact_id: contact.id, lead_id: leadId, source: sourceLabel }),
      ]).catch(() => {});
    }

    if (isNewsletterLead && cleanEmail) {
      const welcome = buildWelcomeEmail(cleanName || contact.name || '');
      const notify = buildJosephNotification({
        name: cleanName || contact.name || '',
        email: cleanEmail || contact.email || '',
        phone: cleanPhone || contact.phone || '',
        source: sourceLabel,
      });

      sendEmailViaGmailUi({
        to: cleanEmail,
        subject: welcome.subject,
        body: welcome.body,
      }).then(() => {
        return query(`
          INSERT INTO notifications (type, icon, title, body, link, meta, is_read)
          VALUES ('lead', '✉️', ?, ?, '/pipeline', ?, 0)
        `, [
          'Welcome email sent automatically',
          `Welcome email sent to ${cleanName || cleanEmail}`,
          JSON.stringify({ contact_id: contact.id, lead_id: leadId, email: cleanEmail, source: sourceLabel }),
        ]).catch(() => {});
      }).catch((err) => {
        console.error('Automatic welcome email failed:', err.message);
        return query(`
          INSERT INTO notifications (type, icon, title, body, link, meta, is_read)
          VALUES ('warning', '⚠️', ?, ?, '/pipeline', ?, 0)
        `, [
          'Automatic welcome email failed',
          `Could not send welcome email to ${cleanName || cleanEmail}: ${err.message}`,
          JSON.stringify({ contact_id: contact.id, lead_id: leadId, email: cleanEmail, source: sourceLabel }),
        ]).catch(() => {});
      });

      sendEmailViaGmailUi({
        to: JOSEPH_NOTIFY_EMAIL,
        subject: notify.subject,
        body: notify.body,
      }).catch((err) => {
        console.error('Joseph lead notification email failed:', err.message);
      });
    }

    if (leadId) {
      triggerLeadSync({
        leadId,
        trigger: 'inbound_lead',
        changedFields: ['contact', 'lead', 'source_channel'],
        initiatedBy: channel || 'website',
      });
    }

    res.status(201).json({
      success: true,
      contact_id: contact.id,
      lead_id: leadId,
      message: 'Lead captured successfully',
    });
  } catch (err) {
    console.error('Inbound lead error:', err);
    res.status(500).json({ error: 'Failed to capture lead' });
  }
};
