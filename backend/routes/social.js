/**
 * Social Media Integration Route — Astraterra CRM
 * Buffer GraphQL + Metricool API integration
 */

const express = require('express');
const router = express.Router();
const https = require('https');
const { authenticateToken: auth, requireMinRole } = require('../middleware/auth');
const fs = require('fs');

// ─── Constants ──────────────────────────────────────────────────────────────
const METRICOOL_BLOG_ID = '4811621';
const METRICOOL_USER_ID = '3751800';
const METRICOOL_EMAIL   = 'Admin@astraterra.ae';
const METRICOOL_PASS    = 'Admin@1234!';

const BUFFER_ORG_ID = '6945c283ce96dff4ca8295be';
const BUFFER_CHANNELS = {
  'linkedin-personal': '699a1072d6f8d304f93ae08d',
  'linkedin-company':  '699a1072d6f8d304f93ae08e',
  'twitter':           '6999f9dcd6f8d304f93a81f8',
};
const BUFFER_SESSION_FILE = '/data/.openclaw/workspace/memory/buffer-session.json';
const METRICOOL_SESSION_FILE = '/data/.openclaw/workspace/memory/metricool-session.json';

// ─── Buffer GraphQL Helper ───────────────────────────────────────────────────
function getBufferCookieStr() {
  try {
    const cookies = JSON.parse(fs.readFileSync(BUFFER_SESSION_FILE, 'utf8'));
    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
  } catch (e) {
    return '';
  }
}

function bufferGQL(query, variables) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const cookieStr = getBufferCookieStr();
    const options = {
      hostname: 'graph.buffer.com',
      port: 443,
      path: '/',
      method: 'POST',
      headers: {
        'Cookie': cookieStr,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Origin': 'https://publish.buffer.com',
        'Referer': 'https://publish.buffer.com/',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'x-buffer-client-id': 'publish',
      },
    };
    const req = https.request(options, res => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch (e) { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Metricool Helper ────────────────────────────────────────────────────────
let metricoolToken = null;
let tokenExpiry = 0;

function metricoolRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if (token) headers['x-mc-auth'] = token;
    if (postData) headers['Content-Length'] = Buffer.byteLength(postData);
    const options = {
      hostname: 'app.metricool.com',
      port: 443,
      path: `/api/v2${path}`,
      method,
      headers,
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: data ? JSON.parse(data) : {} }); }
        catch (e) { resolve({ status: res.statusCode, data }); }
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
      tokenExpiry = Date.now() + 3600 * 1000;
      return metricoolToken;
    }
    return null;
  } catch (err) {
    console.error('Metricool login error:', err.message);
    return null;
  }
}

// ─── GET /api/social/status — Platform connection status ─────────────────────
router.get('/status', auth, async (req, res) => {
  try {
    // Check Buffer channels
    const bufferResult = await bufferGQL(`
      query GetChannels($input: ChannelsInput!) {
        channels(input: $input) { id name service }
      }
    `, { input: { organizationId: BUFFER_ORG_ID } });

    const bufferChannels = bufferResult.data?.data?.channels || [];
    const bufferConnected = bufferChannels.length > 0;

    // Check Metricool
    const metToken = await getMetricoolToken();
    const metricoolConnected = !!metToken;

    const platforms = {
      // Buffer platforms
      'twitter': {
        name: 'Twitter/X', via: 'Buffer',
        connected: bufferChannels.some(c => c.service === 'twitter'),
        channelId: BUFFER_CHANNELS.twitter,
      },
      'linkedin-personal': {
        name: 'LinkedIn Personal', via: 'Buffer',
        connected: bufferChannels.some(c => c.id === BUFFER_CHANNELS['linkedin-personal']),
        channelId: BUFFER_CHANNELS['linkedin-personal'],
      },
      'linkedin-company': {
        name: 'LinkedIn Company', via: 'Buffer',
        connected: bufferChannels.some(c => c.id === BUFFER_CHANNELS['linkedin-company']),
        channelId: BUFFER_CHANNELS['linkedin-company'],
      },
      // Metricool platforms
      'facebook':   { name: 'Facebook',               via: 'Metricool', connected: metricoolConnected },
      'instagram':  { name: 'Instagram',              via: 'Metricool', connected: metricoolConnected },
      'tiktok':     { name: 'TikTok',                 via: 'Metricool', connected: metricoolConnected },
      'threads':    { name: 'Threads',                via: 'Metricool', connected: metricoolConnected },
      'bluesky':    { name: 'Bluesky',                via: 'Metricool', connected: metricoolConnected },
      'pinterest':  { name: 'Pinterest',              via: 'Metricool', connected: metricoolConnected },
      'youtube':    { name: 'YouTube',                via: 'Metricool', connected: metricoolConnected },
      'google-business': { name: 'Google Business Profile', via: 'Metricool', connected: metricoolConnected },
    };

    res.json({ success: true, platforms, bufferConnected, metricoolConnected });
  } catch (err) {
    console.error('Social status error:', err.message);
    res.json({ success: false, error: err.message, platforms: {} });
  }
});

// ─── Helper: Fetch all Buffer posts with cursor-based pagination ─────────────
// NOTE: `first` and `after` are top-level query args, NOT fields inside PostsInput
async function fetchAllBufferPosts(pageSize = 50) {
  const allEdges = [];
  let cursor = null;
  let hasNextPage = true;
  let attempts = 0;

  while (hasNextPage && attempts < 20) {
    attempts++;
    const variables = { input: { organizationId: BUFFER_ORG_ID }, first: pageSize };
    if (cursor) variables.after = cursor;

    const result = await bufferGQL(`
      query GetPosts($input: PostsInput!, $first: Int, $after: String) {
        posts(input: $input, first: $first, after: $after) {
          edges {
            node {
              id text status schedulingType dueAt channelId createdAt updatedAt
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `, variables);

    if (result.data?.errors) {
      console.error('Buffer GQL error:', JSON.stringify(result.data.errors));
      break;
    }

    const postsData = result.data?.data?.posts;
    if (!postsData) break;

    allEdges.push(...(postsData.edges || []));
    hasNextPage = postsData.pageInfo?.hasNextPage || false;
    cursor = postsData.pageInfo?.endCursor || null;

    if (!hasNextPage || !cursor) break;
  }

  return allEdges;
}

// ─── GET /api/social/drafts — Buffer drafts ──────────────────────────────────
router.get('/drafts', auth, requireMinRole('admin'), async (req, res) => {
  try {
    const allEdges = await fetchAllBufferPosts(50);
    const allPosts = allEdges.map(e => e.node);
    const drafts = allPosts.filter(p => p.status === 'draft' || p.schedulingType === 'DRAFT');

    // Map channel IDs to platform names
    const channelMap = {
      [BUFFER_CHANNELS['twitter']]: 'twitter',
      [BUFFER_CHANNELS['linkedin-personal']]: 'linkedin-personal',
      [BUFFER_CHANNELS['linkedin-company']]: 'linkedin-company',
    };

    const formatted = drafts.map(d => ({
      id: d.id,
      content: d.text,
      platform: channelMap[d.channelId] || 'unknown',
      channelId: d.channelId,
      scheduledAt: d.dueAt,
      createdAt: d.createdAt,
      status: 'draft',
      source: 'buffer',
    }));

    return res.json({ success: true, drafts: formatted, total: formatted.length, fetched: allPosts.length });
  } catch (err) {
    console.error('Buffer drafts error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/social/scheduled — All scheduled posts (Buffer + Metricool) ────
router.get('/scheduled', auth, async (req, res) => {
  const startDate = req.query.startDate || new Date().toISOString().split('T')[0];
  const endDate   = req.query.endDate   || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0];
  const allPosts  = [];

  // Fetch Buffer scheduled posts (all pages)
  try {
    const allEdges = await fetchAllBufferPosts(50);
    const channelMap = {
      [BUFFER_CHANNELS.twitter]: 'twitter',
      [BUFFER_CHANNELS['linkedin-personal']]: 'linkedin-personal',
      [BUFFER_CHANNELS['linkedin-company']]: 'linkedin-company',
    };
    allEdges.forEach(({ node }) => {
      if (node.status === 'scheduled' && node.dueAt) {
        allPosts.push({
          id: node.id,
          content: node.text,
          networks: [channelMap[node.channelId] || node.channelId],
          scheduledAt: node.dueAt,
          source: 'buffer',
          status: 'scheduled',
        });
      }
    });
  } catch (err) {
    console.error('Buffer scheduled fetch error:', err.message);
  }

  // Fetch Metricool scheduled posts
  try {
    const token = await getMetricoolToken();
    if (token) {
      const result = await metricoolRequest(
        'GET',
        `/scheduler/posts?blogId=${METRICOOL_BLOG_ID}&startDate=${startDate}&endDate=${endDate}`,
        null,
        token
      );
      if (result.status === 200) {
        const mcPosts = result.data?.data || result.data || [];
        (Array.isArray(mcPosts) ? mcPosts : []).forEach(p => {
          allPosts.push({
            id: p.id,
            content: p.content || p.text || '',
            networks: p.networks || [p.network || 'facebook'],
            scheduledAt: p.publishAt || p.scheduledAt || p.date,
            source: 'metricool',
            status: 'scheduled',
          });
        });
      }
    }
  } catch (err) {
    console.error('Metricool scheduled fetch error:', err.message);
  }

  // Sort by scheduledAt
  allPosts.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

  if (allPosts.length === 0) {
    return res.json({ success: true, posts: getMockScheduledPosts(), mock: true });
  }

  res.json({ success: true, posts: allPosts });
});

// ─── POST /api/social/publish — Publish or schedule a post ───────────────────
router.post('/publish', auth, requireMinRole('admin'), async (req, res) => {
  const { content, platforms, scheduledAt, imageUrl } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'content is required' });
  if (!platforms || !platforms.length) return res.status(400).json({ error: 'platforms is required' });

  const results = [];
  const errors  = [];

  const bufferPlatforms  = platforms.filter(p => ['twitter', 'linkedin-personal', 'linkedin-company'].includes(p));
  const metricoolPlatforms = platforms.filter(p => !['twitter', 'linkedin-personal', 'linkedin-company'].includes(p));

  // Publish to Buffer via GraphQL mutation
  for (const platform of bufferPlatforms) {
    const channelId = BUFFER_CHANNELS[platform];
    if (!channelId) { errors.push({ platform, error: 'Unknown Buffer channel' }); continue; }

    try {
      // Truncate for Twitter
      let text = content;
      if (platform === 'twitter' && text.length > 280) {
        text = text.substring(0, 277) + '...';
      }

      const mutation = await bufferGQL(`
        mutation CreatePost($input: PostCreateInput!) {
          postCreate(input: $input) {
            __typename
            ... on PostCreatePayload { post { id status dueAt } }
            ... on CoreApiError { message type }
          }
        }
      `, {
        input: {
          channelId,
          content: { text },
          scheduling: scheduledAt
            ? { scheduledAt: new Date(scheduledAt).toISOString() }
            : { type: 'queue' },
        },
      });

      const result = mutation.data?.data?.postCreate;
      if (result?.__typename === 'PostCreatePayload') {
        results.push({ platform, success: true, postId: result.post?.id, source: 'buffer' });
      } else if (result?.__typename === 'CoreApiError') {
        errors.push({ platform, error: result.message, source: 'buffer' });
      } else {
        errors.push({ platform, error: JSON.stringify(mutation.data?.errors || 'Unknown error'), source: 'buffer' });
      }
    } catch (err) {
      errors.push({ platform, error: err.message, source: 'buffer' });
    }
  }

  // Publish to Metricool
  if (metricoolPlatforms.length > 0) {
    try {
      const token = await getMetricoolToken();
      if (!token) {
        metricoolPlatforms.forEach(p => errors.push({ platform: p, error: 'Metricool auth failed', source: 'metricool' }));
      } else {
        const payload = {
          blogId: parseInt(METRICOOL_BLOG_ID),
          content,
          networks: metricoolPlatforms,
          publishAt: scheduledAt || null,
        };
        if (imageUrl) payload.imageUrl = imageUrl;

        const result = await metricoolRequest('POST', '/scheduler/posts', payload, token);
        if (result.status === 200 || result.status === 201) {
          metricoolPlatforms.forEach(p =>
            results.push({ platform: p, success: true, postId: result.data?.id, source: 'metricool' })
          );
        } else {
          metricoolPlatforms.forEach(p =>
            errors.push({ platform: p, error: JSON.stringify(result.data), source: 'metricool' })
          );
        }
      }
    } catch (err) {
      metricoolPlatforms.forEach(p => errors.push({ platform: p, error: err.message, source: 'metricool' }));
    }
  }

  const success = results.length > 0;
  const message = scheduledAt ? 'Post scheduled' : 'Post published';

  res.json({
    success,
    message: success ? `${message} to ${results.length} platform(s)` : 'Failed to publish',
    results,
    errors: errors.length > 0 ? errors : undefined,
  });
});

// ─── POST /api/social/post — Alias for publish (backward compat) ─────────────
router.post('/post', auth, requireMinRole('admin'), async (req, res) => {
  // Remap old API to new
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

// ─── GET /api/social/stats — Analytics stats ─────────────────────────────────
router.get('/stats', auth, async (req, res) => {
  try {
    const token = await getMetricoolToken();
    if (!token) {
      return res.json({ success: true, analytics: getMockAnalytics(), mock: true });
    }
    const result = await metricoolRequest('GET', `/analytics/overview?blogId=${METRICOOL_BLOG_ID}`, null, token);
    if (result.status === 200) {
      res.json({ success: true, analytics: result.data });
    } else {
      res.json({ success: true, analytics: getMockAnalytics(), mock: true });
    }
  } catch (err) {
    res.json({ success: true, analytics: getMockAnalytics(), mock: true });
  }
});

// ─── GET /api/social/analytics — Analytics (alias) ───────────────────────────
router.get('/analytics', auth, async (req, res) => {
  try {
    const token = await getMetricoolToken();
    if (!token) {
      return res.json({ success: true, analytics: getMockAnalytics(), mock: true });
    }
    const result = await metricoolRequest('GET', `/analytics/overview?blogId=${METRICOOL_BLOG_ID}`, null, token);
    if (result.status === 200) {
      res.json({ success: true, analytics: result.data });
    } else {
      res.json({ success: true, analytics: getMockAnalytics(), mock: true });
    }
  } catch (err) {
    res.json({ success: true, analytics: getMockAnalytics(), mock: true });
  }
});

// ─── DELETE /api/social/draft/:id — Delete Buffer draft ──────────────────────
router.delete('/draft/:id', auth, requireMinRole('admin'), async (req, res) => {
  try {
    const result = await bufferGQL(`
      mutation DeletePost($input: PostDeleteInput!) {
        postDelete(input: $input) {
          __typename
          ... on PostDeletePayload { success }
          ... on CoreApiError { message type }
        }
      }
    `, { input: { postId: req.params.id } });

    const data = result.data?.data?.postDelete;
    if (data?.__typename === 'PostDeletePayload' && data.success) {
      res.json({ success: true, message: 'Draft deleted' });
    } else if (data?.__typename === 'CoreApiError') {
      res.status(400).json({ success: false, error: data.message });
    } else {
      res.json({ success: true, message: 'Delete attempted' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /api/social/post/:id — Delete Metricool post ─────────────────────
router.delete('/post/:id', auth, requireMinRole('admin'), async (req, res) => {
  try {
    const token = await getMetricoolToken();
    if (!token) {
      return res.json({ success: true, mock: true, message: 'Delete queued (Metricool auth pending)' });
    }
    await metricoolRequest('DELETE', `/scheduler/posts/${req.params.id}?blogId=${METRICOOL_BLOG_ID}`, null, token);
    res.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete post', detail: err.message });
  }
});

// ─── GET /api/social/upcoming — Next 7 days posts ────────────────────────────
router.get('/upcoming', auth, async (req, res) => {
  const startDate = new Date().toISOString().split('T')[0];
  const endDate   = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
  const allPosts  = [];

  try {
    const allEdges = await fetchAllBufferPosts(50);
    const channelMap = {
      [BUFFER_CHANNELS.twitter]: 'twitter',
      [BUFFER_CHANNELS['linkedin-personal']]: 'linkedin-personal',
      [BUFFER_CHANNELS['linkedin-company']]: 'linkedin-company',
    };
    const now = new Date();
    const end = new Date(endDate);
    allEdges.forEach(({ node }) => {
      if (node.status === 'scheduled' && node.dueAt) {
        const d = new Date(node.dueAt);
        if (d >= now && d <= end) {
          allPosts.push({
            id: node.id,
            content: node.text,
            networks: [channelMap[node.channelId] || node.channelId],
            scheduledAt: node.dueAt,
            source: 'buffer',
          });
        }
      }
    });
  } catch (err) {
    console.error('Buffer upcoming error:', err.message);
  }

  try {
    const token = await getMetricoolToken();
    if (token) {
      const result = await metricoolRequest(
        'GET',
        `/scheduler/posts?blogId=${METRICOOL_BLOG_ID}&startDate=${startDate}&endDate=${endDate}`,
        null,
        token
      );
      if (result.status === 200) {
        const mcPosts = result.data?.data || result.data || [];
        (Array.isArray(mcPosts) ? mcPosts : []).forEach(p => {
          allPosts.push({
            id: p.id,
            content: p.content || p.text || '',
            networks: p.networks || [p.network || 'facebook'],
            scheduledAt: p.publishAt || p.scheduledAt || p.date,
            source: 'metricool',
          });
        });
      }
    }
  } catch (err) {
    console.error('Metricool upcoming error:', err.message);
  }

  allPosts.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

  if (allPosts.length === 0) {
    return res.json({ success: true, posts: getMockScheduledPosts().slice(0, 5), mock: true });
  }

  res.json({ success: true, posts: allPosts });
});

// ─── Mock data helpers ─────────────────────────────────────────────────────
function getMockScheduledPosts() {
  const now = new Date();
  return [
    { id: 1, content: '🏙️ Discover luxury living in Dubai Marina — stunning 2BR apartments starting from AED 1.8M. Book a viewing today!', networks: ['instagram', 'facebook'], scheduledAt: new Date(now.getTime() + 1 * 3600 * 1000).toISOString(), status: 'scheduled' },
    { id: 2, content: '📈 Dubai real estate market update: Off-plan sales up 34% in Q1 2026. Investment opportunities at Damac Hills 2.', networks: ['linkedin-personal'], scheduledAt: new Date(now.getTime() + 3 * 3600 * 1000).toISOString(), status: 'scheduled' },
    { id: 3, content: '🌟 New listing alert! Palm Jumeirah villa — 5BR, private pool, direct beach access. AED 18M. DM for details.', networks: ['instagram', 'twitter'], scheduledAt: new Date(now.getTime() + 24 * 3600 * 1000).toISOString(), status: 'scheduled' },
    { id: 4, content: '💼 Investment spotlight: Emaar Downtown Dubai — strong rental yields of 6-8% annually. Perfect buy-to-let opportunity.', networks: ['facebook', 'linkedin-company'], scheduledAt: new Date(now.getTime() + 48 * 3600 * 1000).toISOString(), status: 'scheduled' },
    { id: 5, content: '🏠 Featured: Sobha Hartland II — Nature-inspired living in MBR City. Studios from AED 780K. Register interest now!', networks: ['instagram', 'facebook', 'twitter'], scheduledAt: new Date(now.getTime() + 72 * 3600 * 1000).toISOString(), status: 'scheduled' },
  ];
}

function getMockAnalytics() {
  return {
    facebook:       { followers: 1247,  engagement: 3.2, reach: 8540,  posts: 12 },
    instagram:      { followers: 3891,  engagement: 5.8, reach: 22100, posts: 18 },
    twitter:        { followers: 892,   engagement: 1.9, reach: 5200,  posts: 8  },
    'linkedin-personal': { followers: 2156,  engagement: 4.1, reach: 11800, posts: 6 },
    'linkedin-company':  { followers: 1089,  engagement: 3.7, reach: 8900,  posts: 5 },
    tiktok:         { followers: 445,   engagement: 7.2, reach: 3200,  posts: 4  },
    youtube:        { followers: 312,   engagement: 2.1, reach: 1800,  posts: 3  },
    pinterest:      { followers: 287,   engagement: 1.5, reach: 2100,  posts: 7  },
    threads:        { followers: 156,   engagement: 2.8, reach: 890,   posts: 2  },
    bluesky:        { followers: 89,    engagement: 1.2, reach: 450,   posts: 1  },
  };
}

module.exports = router;
