import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from '@/lib/api';

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === 'string') return response.data.message;
  }
  return error instanceof Error ? error.message : fallback;
}

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;
  const code = location.state?.code;
  
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!email || !code) {
    return <div className="p-8 text-center text-red-500">Accès non autorisé.</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post('/auth/reset-password', { email, code, newPassword });
      alert("Mot de passe modifié avec succès !");
      navigate("/login");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Erreur lors de la réinitialisation"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">
        <h2 className="text-2xl font-bold text-blue-900 mb-2">Nouveau mot de passe</h2>
        <p className="text-gray-500 mb-6 text-sm">
          Modification pour : <span className="font-semibold text-blue-700">{email}</span>
        </p>
        
        {error && (
          <div className="mb-4 text-red-500 text-sm bg-red-50 p-3 rounded-xl border border-red-100">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-xl bg-blue-50 border border-blue-100 focus:ring-2 focus:ring-blue-400 outline-none"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "Enregistrement..." : "Changer le mot de passe"}
          </button>
        </form>
      </div>
    </div>
  );
}