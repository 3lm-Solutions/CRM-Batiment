import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { AuthResponse } from '@/types';

export default function ChangeTemporaryPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const state = location.state as { tempToken?: string; email?: string } | null;
  const tempToken = state?.tempToken;
  const email = state?.email;

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!tempToken) {
    return <div className="p-8 text-center text-red-500">Accès non autorisé.</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post<AuthResponse>(
        '/auth/change-password',
        { newPassword },
        { headers: { Authorization: `Bearer ${tempToken}` } },
      );
      setSession(data.accessToken, data.user);

      if (data.user.role === "TECHNICO") {
        navigate("/technico");
      } else if (data.user.role === "SOUS_TRAITANT") {
        navigate("/sous-traitant");
      } else {
        navigate("/admin");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Erreur lors du changement de mot de passe");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">
        <h2 className="text-2xl font-bold text-blue-900 mb-2">Premiere connexion</h2>
        <p className="text-gray-500 mb-6 text-sm">
          {email ? <>Bienvenue <span className="font-semibold text-blue-700">{email}</span>, </> : null}
          vous devez definir un nouveau mot de passe avant de continuer.
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
              minLength={6}
              className="w-full px-4 py-2 rounded-xl bg-blue-50 border border-blue-100 focus:ring-2 focus:ring-blue-400 outline-none"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le mot de passe</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 rounded-xl bg-blue-50 border border-blue-100 focus:ring-2 focus:ring-blue-400 outline-none"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "Enregistrement..." : "Definir le mot de passe"}
          </button>
        </form>
      </div>
    </div>
  );
}
