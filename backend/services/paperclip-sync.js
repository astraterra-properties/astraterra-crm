/**
 * Paperclip lead-sync service.
 *
 * NOTE: This is a safe placeholder. The original implementation was referenced
 * by routes/leads.js and routes/inbound-lead.js (commit 95356e8) but the file
 * itself was never committed, which crashed the backend on startup with
 * "Cannot find module '../services/paperclip-sync'".
 *
 * triggerLeadSync() is invoked fire-and-forget on lead create / update / inbound,
 * so this stub logs the intent and returns without throwing. Replace the body
 * with the real sync integration when it is available.
 */

/**
 * Fire-and-forget lead sync. Must never throw — callers do not await or catch it.
 * @param {{ leadId: any, trigger: string, changedFields?: string[], initiatedBy?: string }} payload
 */
function triggerLeadSync(payload = {}) {
  try {
    const { leadId, trigger, initiatedBy } = payload;
    console.log(
      `[paperclip-sync] (stub) lead sync requested — lead=${leadId} trigger=${trigger} by=${initiatedBy || 'unknown'}`
    );
    // TODO: replace with the real Paperclip lead-sync integration.
  } catch (err) {
    // Never let a sync failure break the request that triggered it.
    console.error('[paperclip-sync] stub error:', err && err.message);
  }
}

module.exports = { triggerLeadSync };
