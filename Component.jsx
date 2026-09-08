
import React, { useState } from 'react';
import { Star, ShieldCheck, CreditCard, Lock, User, Key, CheckCircle } from 'lucide-react';

// --- MODULE 1: AUTHENTICATION MODAL (LOGIN & REGISTER) ---
export function AuthModal({ isOpen, onClose, onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ full_name: '', email: '', password: '' });
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';

    try {
      const res = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      if (!isRegister) {
        localStorage.setItem('aerozone_token', data.token);
        onLoginSuccess(data.user);
        onClose();
      } else {
        setIsRegister(false);
        alert('Account created successfully! Please log in.');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative border border-slate-100">
        <h3 className="text-xl font-black text-slate-800 mb-1">
          {isRegister ? 'Create an AeroZone Account' : 'Welcome Back to AeroZone'}
        </h3>
        <p className="text-xs text-slate-500 mb-6">
          {isRegister ? 'Join South Africa’s premier daily deal network.' : 'Log in to manage orders and fast checkout.'}
        </p>

        {error && <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs p-3 rounded-lg mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Sipho Dlamini"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg py-2.5 pl-9 pr-3 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Email Address</label>
            <input
              type="email"
              required
              placeholder="name@example.co.za"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg py-2.5 px-3 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Password</label>
            <div className="relative">
              <Key className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg py-2.5 pl-9 pr-3 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg text-xs shadow-md transition">
            {isRegister ? 'Register Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t text-center text-xs text-slate-500">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button onClick={() => setIsRegister(!isRegister)} className="text-blue-600 font-bold underline">
            {isRegister ? 'Log in' : 'Create one now'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- MODULE 2: PRODUCT REVIEWS & RATINGS COMPONENT ---
export function ProductReviews({ productId }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviews, setReviews] = useState([
    { id: 1, author: 'Thabo M.', rating: 5, date: '2 days ago', comment: 'Essential for loadshedding! Kept my Wi-Fi router on for over 6 hours continuously.' },
    { id: 2, author: 'Sarah K.', rating: 4, date: '1 week ago', comment: 'Super fast delivery to Cape Town. Product works exactly as described.' }
  ]);

  const handleAddReview = (e) => {
    e.preventDefault();
    if (!comment) return;
    const newRev = { id: Date.now(), author: 'Verified Buyer', rating, date: 'Just now', comment };
    setReviews([newRev, ...reviews]);
    setComment('');
  };

  return (
    <div className="mt-8 bg-white p-6 rounded-xl border border-slate-200">
      <h3 className="font-bold text-slate-900 text-base mb-4">Customer Reviews & Ratings</h3>
      
      {/* Add Review Form */}
      <form onSubmit={handleAddReview} className="mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
        <label className="text-xs font-bold text-slate-700 block mb-2">Leave a Verified Review</label>
        <div className="flex gap-1 mb-3">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              onClick={() => setRating(star)}
              className={`w-5 h-5 cursor-pointer ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
            />
          ))}
        </div>
        <textarea
          rows="2"
          placeholder="Write your review here..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-600 bg-white mb-2"
        ></textarea>
        <button type="submit" className="bg-slate-900 text-white text-xs font-bold py-2 px-4 rounded-lg hover:bg-blue-600 transition">
          Submit Review
        </button>
      </form>

      {/* Review List */}
      <div className="space-y-4">
        {reviews.map((rev) => (
          <div key={rev.id} className="border-b border-slate-100 pb-3">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-xs text-slate-800">{rev.author}</span>
              <span className="text-[10px] text-slate-400">{rev.date}</span>
            </div>
            <div className="flex items-center gap-1 mb-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`w-3 h-3 ${i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
              ))}
            </div>
            <p className="text-xs text-slate-600">{rev.comment}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
