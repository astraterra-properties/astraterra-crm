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

async function uploadBrochureToCloudinary(file: File): Promise<string> {
  const signRes = await fetch('/api/cloudinary/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder: 'offplan-brochures' }),
  });
  const { timestamp, signature } = await signRes.json();
  const fd = new FormData();
  fd.append('file', file);
  fd.append('api_key', '714597318371755');
  fd.append('timestamp', String(timestamp));
  fd.append('signature', signature);
  fd.append('folder', 'offplan-brochures');
  // Use raw upload endpoint for PDFs
  const res = await fetch('https://api.cloudinary.com/v1_1/dumt7udjd/raw/upload', {
    method: 'POST',
    body: fd,
  });
  const data = await res.json();
  return data.secure_url || '';
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

interface UnitDetail {
  type: string;
  size: string;
  bathrooms: string;
}

interface OffPlanProject {
  id: string;
  name: string;
  developer: string;
  location: string;
  startingPrice: number;
  status: string;
  slug: string;
  createdAt: { seconds: number } | null;
}

export default function ContentOffPlanPage() {
  const router = useRouter();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Project form
  const [name, setName] = useState('');
  const [developer, setDeveloper] = useState('');
  const [location, setLocation] = useState('');
  const [startingPrice, setStartingPrice] = useState('');
  const [handover, setHandover] = useState('');
  const [paymentPlan, setPaymentPlan] = useState('');
  const [roi, setRoi] = useState('');
  const [keyword, setKeyword] = useState('');
  const [description, setDescription] = useState('');
  const [area, setArea] = useState('');
  const [areaDescription, setAreaDescription] = useState('');
  const [ownershipType, setOwnershipType] = useState('Freehold');
  const [numberOfBuildings, setNumberOfBuildings] = useState('');
  const [masterplanName, setMasterplanName] = useState('');
  const [masterplanDescription, setMasterplanDescription] = useState('');

  // Timeline
  const [announced, setAnnounced] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [constructionStart, setConstructionStart] = useState('');

  // Dynamic lists
  const [unitTypes, setUnitTypes] = useState<string[]>(['']);
  const [unitDetails, setUnitDetails] = useState<UnitDetail[]>([{ type: '', size: '', bathrooms: '' }]);
  const [amenities, setAmenities] = useState<string[]>(['']);
  const [landmarks, setLandmarks] = useState<string[]>(['']);

  // Images
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [brochureFile, setBrochureFile] = useState<File | null>(null);
  const [brochureUrl, setBrochureUrl] = useState('');
  const [uploadingBrochure, setUploadingBrochure] = useState(false);

  // Status
  const [status, setStatus] = useState<'published' | 'draft'>('published');

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');

  // Existing projects
  const [projects, setProjects] = useState<OffPlanProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

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

  const fetchProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const q = query(collection(db, 'offPlanProjects'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const list: OffPlanProject[] = snap.docs.map((d) => ({
        id: d.id,
        name: (d.data().name as string) || 'Untitled',
        developer: (d.data().developer as string) || '',
        location: (d.data().location as string) || '',
        startingPrice: (d.data().startingPrice as number) || 0,
        status: (d.data().status as string) || 'draft',
        slug: (d.data().slug as string) || '',
        createdAt: d.data().createdAt || null,
      }));
      setProjects(list);
    } catch (e) {
      console.error(e);
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (firebaseUser) fetchProjects();
  }, [firebaseUser, fetchProjects]);

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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 5);
    setImageFiles(files);
    const previews = files.map((f) => URL.createObjectURL(f));
    setImagePreviews(previews);
  };

  const handleBrochureSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBrochureFile(file);
    setUploadingBrochure(true);
    const url = await uploadBrochureToCloudinary(file);
    setBrochureUrl(url);
    setUploadingBrochure(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !developer.trim()) return;
    setSubmitting(true);
    setSubmitMsg('');
    try {
      const imageUrls: string[] = await Promise.all(
        imageFiles.map((f) => uploadToCloudinary(f, 'offplan'))
      );

      await addDoc(collection(db, 'offPlanProjects'), {
        slug: generateSlug(name + ' ' + developer),
        name,
        developer,
        location,
        startingPrice: Number(startingPrice) || 0,
        handover,
        paymentPlan,
        roi,
        keyword,
        description,
        area,
        areaDescription,
        ownershipType: ownershipType || 'Freehold',
        numberOfBuildings: numberOfBuildings || '1 Tower',
        masterplanName,
        masterplanDescription,
        units: unitTypes.filter((u) => u.trim()),
        unitDetails: unitDetails.filter((u) => u.type.trim()),
        amenities: amenities.filter((a) => a.trim()),
        nearbyLandmarks: landmarks.filter((l) => l.trim()),
        projectTimeline: {
          announced,
          bookingDate,
          constructionStart,
          expectedCompletion: handover,
        },
        images: imageUrls,
        brochureUrl: brochureUrl || null,
        status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        authorId: auth.currentUser?.uid,
      });

      setSubmitMsg(
        status === 'published'
          ? 'Project published successfully.'
          : 'Project saved as draft.'
      );

      // Reset form
      setName(''); setDeveloper(''); setLocation(''); setStartingPrice('');
      setHandover(''); setPaymentPlan(''); setRoi(''); setKeyword('');
      setDescription(''); setArea(''); setAreaDescription('');
      setOwnershipType('Freehold'); setNumberOfBuildings('');
      setMasterplanName(''); setMasterplanDescription('');
      setAnnounced(''); setBookingDate(''); setConstructionStart('');
      setUnitTypes(['']); setUnitDetails([{ type: '', size: '', bathrooms: '' }]);
      setAmenities(['']); setLandmarks(['']);
      setImageFiles([]); setImagePreviews([]);
      setBrochureFile(null); setBrochureUrl(''); setUploadingBrochure(false);
      setStatus('published');
      fetchProjects();
    } catch (err) {
      setSubmitMsg('Error: ' + (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'offPlanProjects', id));
      fetchProjects();
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
                Sign in with your website admin credentials to manage off-plan projects
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
              {loginError && <p className="text-red-400 text-xs">{loginError}</p>}
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

  return (
    <div className="min-h-screen p-6" style={{ background: '#0D1625' }}>
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Off-Plan Projects</h1>
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
          <h2 className="text-lg font-bold text-white mb-6">Add New Off-Plan Project</h2>
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Project Name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Sky Gardens" required />
              </div>
              <div>
                <label className={labelCls}>Developer Name *</label>
                <input type="text" value={developer} onChange={(e) => setDeveloper(e.target.value)} className={inputCls} placeholder="e.g. Emaar Properties" required />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Location</label>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} placeholder="e.g. Dubai Marina, Dubai" />
              </div>
              <div>
                <label className={labelCls}>Starting Price AED</label>
                <input type="number" value={startingPrice} onChange={(e) => setStartingPrice(e.target.value)} className={inputCls} placeholder="e.g. 1500000" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Handover Date</label>
                <input type="text" value={handover} onChange={(e) => setHandover(e.target.value)} className={inputCls} placeholder="e.g. December 2027" />
              </div>
              <div>
                <label className={labelCls}>Payment Plan</label>
                <input type="text" value={paymentPlan} onChange={(e) => setPaymentPlan(e.target.value)} className={inputCls} placeholder="e.g. 70/30" />
              </div>
              <div>
                <label className={labelCls}>Expected ROI</label>
                <input type="text" value={roi} onChange={(e) => setRoi(e.target.value)} className={inputCls} placeholder="e.g. 7-9%" />
              </div>
            </div>

            <div>
              <label className={labelCls}>SEO Keyword</label>
              <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} className={inputCls} placeholder="e.g. luxury apartments dubai marina" />
            </div>

            <div>
              <label className={labelCls}>Project Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} rows={5} placeholder="Describe the project..." />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Area Name</label>
                <input type="text" value={area} onChange={(e) => setArea(e.target.value)} className={inputCls} placeholder="e.g. Dubai Marina" />
              </div>
              <div>
                <label className={labelCls}>Ownership Type</label>
                <select value={ownershipType} onChange={(e) => setOwnershipType(e.target.value)} className={inputCls}>
                  <option value="Freehold">Freehold</option>
                  <option value="Leasehold">Leasehold</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Area Description</label>
              <textarea value={areaDescription} onChange={(e) => setAreaDescription(e.target.value)} className={inputCls} rows={3} placeholder="About the area..." />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Number of Buildings</label>
                <input type="text" value={numberOfBuildings} onChange={(e) => setNumberOfBuildings(e.target.value)} className={inputCls} placeholder="e.g. 1 Tower" />
              </div>
              <div>
                <label className={labelCls}>Masterplan Name (optional)</label>
                <input type="text" value={masterplanName} onChange={(e) => setMasterplanName(e.target.value)} className={inputCls} placeholder="e.g. Dubai Creek Harbour" />
              </div>
            </div>

            <div>
              <label className={labelCls}>Masterplan Description (optional)</label>
              <textarea value={masterplanDescription} onChange={(e) => setMasterplanDescription(e.target.value)} className={inputCls} rows={2} placeholder="About the masterplan..." />
            </div>

            {/* Timeline */}
            <div>
              <label className={labelCls + ' mb-3'}>Project Timeline</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Project Announced</label>
                  <input type="text" value={announced} onChange={(e) => setAnnounced(e.target.value)} className={inputCls} placeholder="e.g. January 2024" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Expected Booking Date</label>
                  <input type="text" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} className={inputCls} placeholder="e.g. March 2024" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Construction Start</label>
                  <input type="text" value={constructionStart} onChange={(e) => setConstructionStart(e.target.value)} className={inputCls} placeholder="e.g. Q2 2024" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Expected Completion</label>
                  <input type="text" value={handover} onChange={(e) => setHandover(e.target.value)} className={inputCls} placeholder="e.g. December 2027" />
                </div>
              </div>
            </div>

            {/* Unit Types */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelCls} style={{ marginBottom: 0 }}>Unit Types</label>
                <button type="button" onClick={() => setUnitTypes([...unitTypes, ''])} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-amber-400/30 text-amber-400 hover:bg-amber-400/10 transition-colors">
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <div className="space-y-2">
                {unitTypes.map((ut, i) => (
                  <div key={i} className="flex gap-2">
                    <input type="text" value={ut} onChange={(e) => { const arr = [...unitTypes]; arr[i] = e.target.value; setUnitTypes(arr); }} className={inputCls} placeholder="e.g. 2 Bedroom Apartment" />
                    {unitTypes.length > 1 && (
                      <button type="button" onClick={() => setUnitTypes(unitTypes.filter((_, idx) => idx !== i))} className="text-red-400/60 hover:text-red-400 flex-shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Unit Details */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelCls} style={{ marginBottom: 0 }}>Unit Details</label>
                <button type="button" onClick={() => setUnitDetails([...unitDetails, { type: '', size: '', bathrooms: '' }])} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-amber-400/30 text-amber-400 hover:bg-amber-400/10 transition-colors">
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <div className="space-y-2">
                {unitDetails.map((ud, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input type="text" value={ud.type} onChange={(e) => { const arr = [...unitDetails]; arr[i] = { ...arr[i], type: e.target.value }; setUnitDetails(arr); }} className={inputCls} placeholder="Unit Type" />
                    <input type="text" value={ud.size} onChange={(e) => { const arr = [...unitDetails]; arr[i] = { ...arr[i], size: e.target.value }; setUnitDetails(arr); }} className={inputCls} placeholder="Size sqft" />
                    <input type="text" value={ud.bathrooms} onChange={(e) => { const arr = [...unitDetails]; arr[i] = { ...arr[i], bathrooms: e.target.value }; setUnitDetails(arr); }} className={inputCls} placeholder="Bathrooms" />
                    {unitDetails.length > 1 && (
                      <button type="button" onClick={() => setUnitDetails(unitDetails.filter((_, idx) => idx !== i))} className="text-red-400/60 hover:text-red-400 flex-shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Amenities */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelCls} style={{ marginBottom: 0 }}>Amenities</label>
                <button type="button" onClick={() => setAmenities([...amenities, ''])} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-amber-400/30 text-amber-400 hover:bg-amber-400/10 transition-colors">
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <div className="space-y-2">
                {amenities.map((a, i) => (
                  <div key={i} className="flex gap-2">
                    <input type="text" value={a} onChange={(e) => { const arr = [...amenities]; arr[i] = e.target.value; setAmenities(arr); }} className={inputCls} placeholder="e.g. Swimming Pool" />
                    {amenities.length > 1 && (
                      <button type="button" onClick={() => setAmenities(amenities.filter((_, idx) => idx !== i))} className="text-red-400/60 hover:text-red-400 flex-shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Nearby Landmarks */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelCls} style={{ marginBottom: 0 }}>Nearby Landmarks (optional)</label>
                <button type="button" onClick={() => setLandmarks([...landmarks, ''])} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-amber-400/30 text-amber-400 hover:bg-amber-400/10 transition-colors">
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <div className="space-y-2">
                {landmarks.map((l, i) => (
                  <div key={i} className="flex gap-2">
                    <input type="text" value={l} onChange={(e) => { const arr = [...landmarks]; arr[i] = e.target.value; setLandmarks(arr); }} className={inputCls} placeholder="e.g. Dubai Mall - 12 mins" />
                    {landmarks.length > 1 && (
                      <button type="button" onClick={() => setLandmarks(landmarks.filter((_, idx) => idx !== i))} className="text-red-400/60 hover:text-red-400 flex-shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Images */}
            <div>
              <label className={labelCls}>Project Images (up to 5)</label>
              <input type="file" accept="image/*" multiple onChange={handleImageChange} className={inputCls} />
              {imagePreviews.length > 0 && (
                <div className="flex gap-3 mt-3 flex-wrap">
                  {imagePreviews.map((src, i) => (
                    <img key={i} src={src} alt={`preview ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border border-white/10" />
                  ))}
                </div>
              )}
            </div>

            {/* Project Brochure */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#C5A265', marginBottom: 8 }}>
                Project Brochure (Optional)
              </h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>
                Upload the official PDF brochure. Visitors submit their contact details before downloading.
              </p>
              <label style={{ display: 'block', cursor: 'pointer' }}>
                <div style={{
                  border: '2px dashed rgba(197,162,101,0.3)',
                  borderRadius: 10,
                  padding: '20px 24px',
                  textAlign: 'center',
                  background: 'rgba(197,162,101,0.05)',
                }}>
                  {uploadingBrochure ? (
                    <span style={{ color: '#C5A265' }}>Uploading PDF...</span>
                  ) : brochureUrl ? (
                    <span style={{ color: '#4ade80' }}>✓ Brochure uploaded successfully</span>
                  ) : (
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Click to select PDF brochure
                    </span>
                  )}
                </div>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleBrochureSelect}
                  style={{ display: 'none' }}
                />
              </label>
              {brochureFile && (
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
                  {brochureFile.name}
                </p>
              )}
            </div>

            {/* Status */}
            <div>
              <label className={labelCls}>Status</label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                  <input type="radio" value="published" checked={status === 'published'} onChange={() => setStatus('published')} className="accent-amber-400" />
                  Published
                </label>
                <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                  <input type="radio" value="draft" checked={status === 'draft'} onChange={() => setStatus('draft')} className="accent-amber-400" />
                  Draft
                </label>
              </div>
            </div>

            {submitMsg && (
              <p className={`text-sm ${submitMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
                {submitMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl font-bold text-sm transition-opacity disabled:opacity-50"
              style={goldBtn}
            >
              {submitting
                ? 'Saving...'
                : status === 'published'
                ? 'Publish Project'
                : 'Save as Draft'}
            </button>
          </form>
        </div>

        {/* Existing Projects */}
        <div className="rounded-2xl border border-white/10 p-6" style={{ background: '#131B2B' }}>
          <h2 className="text-lg font-bold text-white mb-4">Manage Off-Plan Projects</h2>
          {projectsLoading ? (
            <p className="text-white/40 text-sm">Loading projects...</p>
          ) : projects.length === 0 ? (
            <p className="text-white/40 text-sm">No projects yet.</p>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => {
                const date = project.createdAt
                  ? new Date(project.createdAt.seconds * 1000).toLocaleDateString()
                  : 'Unknown date';
                const isPublished = project.status === 'published';
                const priceFormatted = project.startingPrice
                  ? 'AED ' + project.startingPrice.toLocaleString()
                  : 'Price TBC';
                return (
                  <div
                    key={project.id}
                    className="rounded-xl border border-white/10 px-4 py-3"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-white truncate">{project.name}</p>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                            style={{
                              background: isPublished ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
                              color: isPublished ? '#4ade80' : '#fbbf24',
                            }}
                          >
                            {isPublished ? 'Published' : 'Draft'}
                          </span>
                        </div>
                        <p className="text-xs text-white/40 mt-0.5">
                          {project.developer} &middot; {project.location} &middot; {priceFormatted} &middot; {date}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {project.slug && (
                          <a
                            href={`https://www.astraterra.ae/off-plan/${project.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View
                          </a>
                        )}
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-red-400/20 text-red-400/70 hover:text-red-400 hover:border-red-400/40 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
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
