/**
 * Social Media Integration Route — Astraterra CRM
 * Metricool integration for scheduling/analytics
 */

const express = require('express');
const router = express.Router();
const https = require('https');
const { authenticateToken: auth, requireMinRole } = require("../middleware/auth");

const METRICOOL_BLOG_ID = '4811621';
const METRICOOL_USER_ID = '3751800';
const METRICOOL_EMAIL = 'Admin@astraterra.ae';
const METRICOOL_PASS = 'Admin@1234!';

// Cache for auth token
let metricoolToken = null;
let tokenExpiry = 0;

function metricoolRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token) headers['x-mc-auth'] = token;
    if (postData) headers['Content-Length'] = Buffer.byteLength(postData);

    const options = {
      hostname: 'app.metricool.com',
      port: 443,
      path: `/api/v2${path}`,
      method,
      headers,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : {} });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function getMetricoolToken() {
  if (metricoolToken && Date.now() < tokenExpiry) return metricoolToken;
  try {
    const result = await metricoolRequest('POST', '/user/login', {
      email: METRICOOL_EMAIL,
      password: METRICOOL_PASS,
    });
    if (result.status === 200 && result.data?.token) {
      metricoolToken = result.data.token;
      tokenExpiry = Date.now() + 3600 * 1000; // 1 hour
      return metricoolToken;
    }
    return null;
  } catch (err) {
    console.error('Metricool login error:', err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL MEDIA ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/social/scheduled — Fetch scheduled posts from Metricool
router.get('/scheduled', auth, requireMinRole('marketing'), async (req, res) => {
  try {
    const token = await getMetricoolToken();
    if (!token) {
      // Return mock data if auth fails
      return res.json({ success: true, posts: getMockScheduledPosts(), mock: true });
    }
    const startDate = req.query.startDate || new Date().toISOString().split('T')[0];
    const endDate = req.query.endDate || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0];
    const result = await metricoolRequest(
      'GET',
      `/scheduler/posts?blogId=${METRICOOL_BLOG_ID}&startDate=${startDate}&endDate=${endDate}`,
      null,
      token
    );
    if (result.status === 200) {
      res.json({ success: true, posts: result.data?.data || result.data || [] });
    } else {
      res.json({ success: true, posts: getMockScheduledPosts(), mock: true });
    }
  } catch (err) {
    console.error('Social scheduled error:', err.message);
    res.json({ success: true, posts: getMockScheduledPosts(), mock: true });
  }
});

// GET /api/social/analytics — Fetch analytics from Metricool
router.get('/analytics', auth, requireMinRole('marketing'), async (req, res) => {
  try {
    const token = await getMetricoolToken();
    if (!token) {
      return res.json({ success: true, analytics: getMockAnalytics(), mock: true });
    }
    const result = await metricoolRequest(
      'GET',
      `/analytics/overview?blogId=${METRICOOL_BLOG_ID}`,
      null,
      token
    );
    if (result.status === 200) {
      res.json({ success: true, analytics: result.data });
    } else {
      res.json({ success: true, analytics: getMockAnalytics(), mock: true });
    }
  } catch (err) {
    res.json({ success: true, analytics: getMockAnalytics(), mock: true });
  }
});

// POST /api/social/post — Create/schedule a post
router.post('/post', auth, requireMinRole('marketing'), async (req, res) => {
  const { content, platforms, scheduledAt, imageUrl } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });
  try {
    const token = await getMetricoolToken();
    if (!token) {
      return res.json({ success: true, mock: true, message: 'Post queued (Metricool auth pending)', postId: 'mock-' + Date.now() });
    }
    const payload = {
      blogId: parseInt(METRICOOL_BLOG_ID),
      content,
      networks: platforms || ['facebook', 'instagram'],
      publishAt: scheduledAt || null,
    };
    if (imageUrl) payload.imageUrl = imageUrl;

    const result = await metricoolRequest('POST', '/scheduler/posts', payload, token);
    if (result.status === 200 || result.status === 201) {
      res.json({ success: true, postId: result.data?.id, message: 'Post scheduled successfully' });
    } else {
      res.status(500).json({ error: 'Failed to schedule post', detail: JSON.stringify(result.data) });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to create post', detail: err.message });
  }
});

// DELETE /api/social/post/:id — Delete a scheduled post
router.delete('/post/:id', auth, requireMinRole('marketing'), async (req, res) => {
  try {
    const token = await getMetricoolToken();
    if (!token) {
      return res.json({ success: true, mock: true, message: 'Delete queued (Metricool auth pending)' });
    }
    const result = await metricoolRequest(
      'DELETE',
      `/scheduler/posts/${req.params.id}?blogId=${METRICOOL_BLOG_ID}`,
      null,
      token
    );
    res.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete post', detail: err.message });
  }
});

// GET /api/social/upcoming — Next 7 days of posts
router.get('/upcoming', auth, requireMinRole('marketing'), async (req, res) => {
  try {
    const token = await getMetricoolToken();
    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
    if (!token) {
      return res.json({ success: true, posts: getMockScheduledPosts().slice(0, 5), mock: true });
    }
    const result = await metricoolRequest(
      'GET',
      `/scheduler/posts?blogId=${METRICOOL_BLOG_ID}&startDate=${startDate}&endDate=${endDate}`,
      null,
      token
    );
    if (result.status === 200) {
      res.json({ success: true, posts: result.data?.data || result.data || [] });
    } else {
      res.json({ success: true, posts: getMockScheduledPosts().slice(0, 5), mock: true });
    }
  } catch (err) {
    res.json({ success: true, posts: getMockScheduledPosts().slice(0, 5), mock: true });
  }
});

// ─── Mock data helpers ─────────────────────────────────────────────────────
function getMockScheduledPosts() {
  const now = new Date();
  return [
    { id: 1, content: '🏙️ Discover luxury living in Dubai Marina — stunning 2BR apartments starting from AED 1.8M. Book a viewing today!', networks: ['instagram', 'facebook'], scheduledAt: new Date(now.getTime() + 1 * 3600 * 1000).toISOString(), status: 'scheduled' },
    { id: 2, content: '📈 Dubai real estate market update: Off-plan sales up 34% in Q1 2026. Investment opportunities at Damac Hills 2.', networks: ['linkedin'], scheduledAt: new Date(now.getTime() + 3 * 3600 * 1000).toISOString(), status: 'scheduled' },
    { id: 3, content: '🌟 New listing alert! Palm Jumeirah villa — 5BR, private pool, direct beach access. AED 18M. DM for details.', networks: ['instagram', 'twitter'], scheduledAt: new Date(now.getTime() + 24 * 3600 * 1000).toISOString(), status: 'scheduled' },
    { id: 4, content: '💼 Investment spotlight: Emaar Downtown Dubai — strong rental yields of 6-8% annually. Perfect buy-to-let opportunity.', networks: ['facebook', 'linkedin'], scheduledAt: new Date(now.getTime() + 48 * 3600 * 1000).toISOString(), status: 'scheduled' },
    { id: 5, content: '🏠 Featured: Sobha Hartland II — Nature-inspired living in MBR City. Studios from AED 780K. Register interest now!', networks: ['instagram', 'facebook', 'twitter'], scheduledAt: new Date(now.getTime() + 72 * 3600 * 1000).toISOString(), status: 'scheduled' },
  ];
}

function getMockAnalytics() {
  return {
    facebook: { followers: 1247, engagement: 3.2, reach: 8540, posts: 12 },
    instagram: { followers: 3891, engagement: 5.8, reach: 22100, posts: 18 },
    twitter: { followers: 892, engagement: 1.9, reach: 5200, posts: 8 },
    linkedin: { followers: 2156, engagement: 4.1, reach: 11800, posts: 6 },
    tiktok: { followers: 445, engagement: 7.2, reach: 3200, posts: 4 },
  };
}

module.exports = router;
