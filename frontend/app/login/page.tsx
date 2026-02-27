'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { Eye, EyeOff, Star, Lock, Mail } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, { email, password })
      const { token, user } = response.data
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.setItem('userRole', user.role || 'agent')
      localStorage.setItem('userName', user.name || '')
      localStorage.setItem('userEmail', user.email || '')
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #131B2B 0%, #1a2540 50%, #0d1420 100%)' }}
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #C9A96E, transparent)' }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #C9A96E, transparent)' }}
        />
        <div className="absolute top-1/4 left-10 w-2 h-2 rounded-full opacity-30" style={{ background: '#C9A96E' }} />
        <div className="absolute top-1/3 right-20 w-1.5 h-1.5 rounded-full opacity-20" style={{ background: '#C9A96E' }} />
        <div className="absolute bottom-1/4 left-1/4 w-1 h-1 rounded-full opacity-25" style={{ background: '#C9A96E' }} />
      </div>

      <div className="w-full max-w-md relative">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Top gold bar */}
          <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #C9A96E, #8A6F2F, #C9A96E)' }} />

          <div className="px-8 py-10">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}>
                <Star className="w-8 h-8 fill-current" style={{ color: '#C9A96E' }} />
              </div>
              <h1 className="text-2xl font-bold" style={{ color: '#131B2B' }}>Astraterra CRM</h1>
              <p className="text-sm mt-1.5" style={{ color: '#6b7280' }}>Real Estate Excellence</p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-5 p-3.5 rounded-lg text-sm border" style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#DC2626' }}>
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                    <Mail className="w-4 h-4" style={{ color: '#9CA3AF' }} />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border text-sm transition-all focus:outline-none"
                    style={{ borderColor: '#E5E7EB', color: '#111827' }}
                    placeholder="admin@astraterra.ae"
                    required
                    onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; e.target.style.boxShadow = '0 0 0 3px rgba(201,169,110,0.15)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4" style={{ color: '#9CA3AF' }} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-11 py-3 rounded-lg border text-sm transition-all focus:outline-none"
                    style={{ borderColor: '#E5E7EB', color: '#111827' }}
                    placeholder="••••••••"
                    required
                    onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; e.target.style.boxShadow = '0 0 0 3px rgba(201,169,110,0.15)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-3.5 flex items-center"
                    style={{ color: '#9CA3AF' }}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                style={{
                  background: loading ? '#8A6F2F' : 'linear-gradient(135deg, #C9A96E, #8A6F2F)',
                  boxShadow: '0 4px 15px rgba(201,169,110,0.3)',
                }}
                onMouseEnter={(e) => { if (!loading) { (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #8A6F2F, #6b5520)'; } }}
                onMouseLeave={(e) => { if (!loading) { (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #C9A96E, #8A6F2F)'; } }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  'Sign In to CRM'
                )}
              </button>
            </form>

            {/* Forgot password note */}
            <p className="mt-6 text-center text-xs" style={{ color: '#9CA3AF' }}>
              Contact your administrator if you've forgotten your password.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
          © 2024 Astra Terra Properties · Oxford Tower, Business Bay, Dubai
        </p>
      </div>
    </div>
  )
}
