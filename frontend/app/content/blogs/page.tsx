'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Trash2, ExternalLink, Plus, X, Key } from 'lucide-react';

const inputCls =
  'bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 w-full focus:outline-none focus:border-amber-400/50 placeholder-white/30 text-sm';
const labelCls = 'text-sm font-medium text-white/70 mb-1 block';
const goldBtn = {
  background: 'linear-gradient(135deg, #DEC993 0%, #C5A265 50%, #B59556 100%)',
  color: '#0D1625',
};

function generateSlug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

async function uploadToCloudinary(file: File, folder: string): Promise<string> {
  const signRes = await fetch('/api/cloudinary/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder }),
  });
  const { timestamp, signature } = await signRes.json();
  const fd = new FormData();
  fd.append('file', file);
  fd.append('api_key', '714597318371755');
  fd.append('timestamp', String(timestamp));
  fd.append('signature', signature);
  fd.append('folder', folder);
  const res = await fetch('https://api.cloudinary.com/v1_1/dumt7udjd/image/upload', {
    method: 'POST',
    body: fd,
  });
  const data = await res.json();
  return data.secure_url || '';
}

interface Section {
  heading: string;
  content: string;
  imageFile: File | null;
}

interface BlogPost {
  id: string;
  title: string;
  createdAt: { seconds: number } | null;
  slug: string;
}

export default function BlogsPage() {
  const router = useRouter();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Blog form
  const [title, setTitle] = useState('');
  const [mainImageFile, setMainImageFile] = useState<File | null>(null);
  const [authorName, setAuthorName] = useState('');
  const [authorBio, setAuthorBio] = useState('');
  const [authorContact, setAuthorContact] = useState('');
  const [keyTakeaways, setKeyTakeaways] = useState('');
  const [showTOC, setShowTOC] = useState(true);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [sections, setSections] = useState<Section[]>([{ heading: '', content: '', imageFile: null }]);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState('');

  // Existing blogs
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [blogsLoading, setBlogsLoading] = useState(false);

  // CRM auth guard
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  // Firebase auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  const fetchBlogs = useCallback(async () => {
    setBlogsLoading(true);
    try {
      const q = query(collection(db, 'blogs'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const list: BlogPost[] = snap.docs.map((d) => ({
        id: d.id,
        title: (d.data().title as string) || 'Untitled',
        createdAt: d.data().createdAt || null,
        slug: (d.data().slug as string) || '',
      }));
      setBlogs(list);
    } catch (e) {
      console.error(e);
    } finally {
      setBlogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (firebaseUser) fetchBlogs();
  }, [firebaseUser, fetchBlogs]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch (err: unknown) {
      setLoginError((err as Error).message || 'Sign-in failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleDisconnect = async () => {
    await signOut(auth);
  };

  const addSection = () =>
    setSections((prev) => [...prev, { heading: '', content: '', imageFile: null }]);

  const removeSection = (i: number) =>
    setSections((prev) => prev.filter((_, idx) => idx !== i));

  const updateSection = (i: number, field: keyof Section, value: string | File | null) =>
    setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setPublishing(true);
    setPublishMsg('');
    try {
      let mainImageUrl = '';
      if (mainImageFile) mainImageUrl = await uploadToCloudinary(mainImageFile, 'blogs');

      let attachmentUrl = '';
      if (attachmentFile) {
        const signRes = await fetch('/api/cloudinary/sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder: 'blogs/attachments' }),
        });
        const { timestamp, signature } = await signRes.json();
        const fd = new FormData();
        fd.append('file', attachmentFile);
        fd.append('api_key', '714597318371755');
        fd.append('timestamp', String(timestamp));
        fd.append('signature', signature);
        fd.append('folder', 'blogs/attachments');
        fd.append('resource_type', 'raw');
        const r = await fetch('https://api.cloudinary.com/v1_1/dumt7udjd/raw/upload', {
          method: 'POST',
          body: fd,
        });
        const rd = await r.json();
        attachmentUrl = rd.secure_url || '';
      }

      const processedSections = await Promise.all(
        sections.map(async (s) => {
          let imageUrl = '';
          if (s.imageFile) imageUrl = await uploadToCloudinary(s.imageFile, 'blogs/sections');
          return { heading: s.heading, content: s.content, imageUrl };
        })
      );

      await addDoc(collection(db, 'blogs'), {
        title,
        slug: generateSlug(title),
        mainImageUrl,
        sections: processedSections,
        authorName,
        authorBio,
        authorContact,
        keyTakeaways,
        showTOC,
        attachmentUrl: attachmentUrl || null,
        createdAt: serverTimestamp(),
        authorId: auth.currentUser?.uid,
        authorEmail: auth.currentUser?.email,
      });

      setPublishMsg('Blog post published successfully.');
      setTitle('');
      setMainImageFile(null);
      setAuthorName('');
      setAuthorBio('');
      setAuthorContact('');
      setKeyTakeaways('');
      setShowTOC(true);
      setAttachmentFile(null);
      setSections([{ heading: '', content: '', imageFile: null }]);
      fetchBlogs();
    } catch (err) {
      setPublishMsg('Error: ' + (err as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this blog post? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'blogs', id));
      fetchBlogs();
    } catch (err) {
      alert('Delete failed: ' + (err as Error).message);
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1625' }}>
        <div className="text-white/50 text-sm">Loading...</div>
      </div>
    );
  }

  // Firebase login screen
  if (!firebaseUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0D1625' }}>
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-white/10 p-8" style={{ background: '#131B2B' }}>
            <div className="flex flex-col items-center mb-6">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                style={{ background: 'rgba(197,162,101,0.15)' }}
              >
                <Key className="w-6 h-6" style={{ color: '#C5A265' }} />
              </div>
              <h1 className="text-xl font-bold text-white mb-1">Connect to Website CMS</h1>
              <p className="text-sm text-white/50 text-center">
                Sign in with your website admin credentials to manage blog posts
              </p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className={labelCls}>Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className={inputCls}
                  placeholder="admin@astraterra.ae"
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className={inputCls}
                  placeholder="••••••••"
                  required
                />
              </div>
              {loginError && (
                <p className="text-red-400 text-xs">{loginError}</p>
              )}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-2.5 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-50"
                style={goldBtn}
              >
                {loginLoading ? 'Connecting...' : 'Connect'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Main content
  return (
    <div className="min-h-screen p-6" style={{ background: '#0D1625' }}>
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Blog Posts</h1>
            <p className="text-sm text-white/50 mt-0.5">Connected as {firebaseUser.email}</p>
          </div>
          <button
            onClick={handleDisconnect}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-colors"
          >
            Disconnect
          </button>
        </div>

        {/* Create Form */}
        <div className="rounded-2xl border border-white/10 p-6" style={{ background: '#131B2B' }}>
          <h2 className="text-lg font-bold text-white mb-6">Create New Blog Post</h2>
          <form onSubmit={handlePublish} className="space-y-5">

            <div>
              <label className={labelCls}>Blog Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputCls}
                placeholder="Enter blog title..."
                required
              />
            </div>

            <div>
              <label className={labelCls}>Main Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setMainImageFile(e.target.files?.[0] || null)}
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Author Name</label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. Joseph Talaat"
                />
              </div>
              <div>
                <label className={labelCls}>Author Contact</label>
                <input
                  type="text"
                  value={authorContact}
                  onChange={(e) => setAuthorContact(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. joseph@astraterra.ae"
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Author Bio</label>
              <textarea
                value={authorBio}
                onChange={(e) => setAuthorBio(e.target.value)}
                className={inputCls}
                rows={2}
                placeholder="Short bio about the author..."
              />
            </div>

            <div>
              <label className={labelCls}>
                Key Takeaways
                <span className="ml-1 text-white/30 font-normal">(one per line)</span>
              </label>
              <textarea
                value={keyTakeaways}
                onChange={(e) => setKeyTakeaways(e.target.value)}
                className={inputCls}
                rows={3}
                placeholder="Enter each takeaway on a new line..."
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="showTOC"
                checked={showTOC}
                onChange={(e) => setShowTOC(e.target.checked)}
                className="w-4 h-4 accent-amber-400"
              />
              <label htmlFor="showTOC" className="text-sm text-white/70">
                Show Table of Contents
              </label>
            </div>

            <div>
              <label className={labelCls}>Attachment PDF</label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                className={inputCls}
              />
            </div>

            {/* Sections */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className={labelCls} style={{ marginBottom: 0 }}>Blog Sections</label>
                <button
                  type="button"
                  onClick={addSection}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-400/30 text-amber-400 hover:bg-amber-400/10 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Section
                </button>
              </div>
              <div className="space-y-4">
                {sections.map((section, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-white/10 p-4 space-y-3"
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                        Section {i + 1}
                      </span>
                      {sections.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSection(i)}
                          className="text-red-400/60 hover:text-red-400 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div>
                      <label className={labelCls}>Section Heading</label>
                      <input
                        type="text"
                        value={section.heading}
                        onChange={(e) => updateSection(i, 'heading', e.target.value)}
                        className={inputCls}
                        placeholder="Section heading..."
                      />
                    </div>
                    <div>
                      <label className={labelCls}>
                        Content
                        <span className="ml-1 text-white/30 font-normal">(HTML supported)</span>
                      </label>
                      <textarea
                        value={section.content}
                        onChange={(e) => updateSection(i, 'content', e.target.value)}
                        className={inputCls}
                        rows={8}
                        placeholder="<p>Section content here...</p>"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Section Image (optional)</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => updateSection(i, 'imageFile', e.target.files?.[0] || null)}
                        className={inputCls}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {publishMsg && (
              <p className={`text-sm ${publishMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
                {publishMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={publishing}
              className="w-full py-3 rounded-xl font-bold text-sm transition-opacity disabled:opacity-50"
              style={goldBtn}
            >
              {publishing ? 'Publishing...' : 'Publish Blog Post'}
            </button>
          </form>
        </div>

        {/* Existing Blogs */}
        <div className="rounded-2xl border border-white/10 p-6" style={{ background: '#131B2B' }}>
          <h2 className="text-lg font-bold text-white mb-4">Manage Blog Posts</h2>
          {blogsLoading ? (
            <p className="text-white/40 text-sm">Loading blogs...</p>
          ) : blogs.length === 0 ? (
            <p className="text-white/40 text-sm">No blog posts yet.</p>
          ) : (
            <div className="space-y-3">
              {blogs.map((blog) => {
                const date = blog.createdAt
                  ? new Date(blog.createdAt.seconds * 1000).toLocaleDateString()
                  : 'Unknown date';
                return (
                  <div
                    key={blog.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{blog.title}</p>
                      <p className="text-xs text-white/40">{date}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      <a
                        href={`https://www.astraterra.ae/admin/edit/${blog.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Edit
                      </a>
                      <button
                        onClick={() => handleDelete(blog.id)}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-red-400/20 text-red-400/70 hover:text-red-400 hover:border-red-400/40 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
