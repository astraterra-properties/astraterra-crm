'use client'

import { useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { Mail, Star, ArrowLeft, CheckCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await axios.post(`${API_URL}/api/auth/forgot-password`, { email })
      setSent(true)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #131B2B 0%, #1a2540 50%, #0d1420 100%)' }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-5" style={{ background: 'radial-gradient(circle, #C9A96E, transparent)' }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-5" style={{ background: 'radial-gradient(circle, #C9A96E, transparent)' }} />
      </div>

      <div className="w-full max-w-md relative">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #C9A96E, #8A6F2F, #C9A96E)' }} />

          <div className="px-8 py-10">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}>
                <Star className="w-8 h-8 fill-current" style={{ color: '#C9A96E' }} />
              </div>
              <h1 className="text-2xl font-bold" style={{ color: '#131B2B' }}>Forgot Password</h1>
              <p className="text-sm mt-1.5" style={{ color: '#6b7280' }}>We'll send a reset link to your email</p>
            </div>

            {sent ? (
              <div className="text-center py-4">
                <div className="flex justify-center mb-4">
                  <CheckCircle className="w-14 h-14" style={{ color: '#22c55e' }} />
                </div>
                <h2 className="text-lg font-semibold mb-2" style={{ color: '#131B2B' }}>Check your inbox</h2>
                <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
                  If <strong>{email}</strong> is registered, you'll receive a reset link shortly.
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
                  style={{ color: '#C9A96E' }}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to login
                </Link>
              </div>
            ) : (
              <>
                {error && (
                  <div className="mb-5 p-3.5 rounded-lg text-sm border" style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#DC2626' }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
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
                        placeholder="joseph@astraterra.ae"
                        required
                        onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; e.target.style.boxShadow = '0 0 0 3px rgba(201,169,110,0.15)'; }}
                        onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-4 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      background: loading ? '#8A6F2F' : 'linear-gradient(135deg, #C9A96E, #8A6F2F)',
                      boxShadow: '0 4px 15px rgba(201,169,110,0.3)',
                    }}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Sending...
                      </span>
                    ) : (
                      'Send Reset Link'
                    )}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <Link href="/login" className="inline-flex items-center gap-1.5 text-sm hover:underline" style={{ color: '#C9A96E' }}>
                    <ArrowLeft className="w-4 h-4" />
                    Back to login
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
          © 2024 Astra Terra Properties · Oxford Tower, Business Bay, Dubai
        </p>
      </div>
    </div>
  )
}
