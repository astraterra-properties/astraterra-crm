/**
 * Lead-sync hook.
 *
 * Called fire-and-forget by routes/leads.js and routes/inbound-lead.js on every
 * lead create / update / inbound. It forwards the event to the in-house email
 * automation engine so lead-driven emails (welcome, nurture, hot-lead, etc.)
 * trigger automatically. Must never throw — callers do not await or catch it.
 *
 * @param {{ leadId: any, trigger: string, changedFields?: string[], initiatedBy?: string }} payload
 */
function triggerLeadSync(payload = {}) {
  try {
    const automation = require('./email-automation');
    // Fire-and-forget; swallow async errors so a sync failure never breaks the request.
    Promise.resolve(automation.onLeadEvent(payload)).catch((err) => {
      console.error('[paperclip-sync] automation error:', err && err.message);
    });
  } catch (err) {
    console.error('[paperclip-sync] error:', err && err.message);
  }
}

module.exports = { triggerLeadSync };
