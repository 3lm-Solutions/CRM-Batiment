import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from '@/lib/api';

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === 'string') return response.data.message;
  }
  return error instanceof Error ? error.message : fallback;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await api.post('/auth/forgot-password', { email: normalizedEmail });
      setEmail(response.data.email);
      setCodeSent(true);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Email introuvable"));
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const normalizedEmail = email.trim().toLowerCase();
      await api.post('/auth/verify-reset-code', { email: normalizedEmail, code });
      navigate("/reset-password", { state: { email: normalizedEmail, code } });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Code invalide ou expire"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">
        <h2 className="text-2xl font-bold text-blue-900 mb-2">Mot de passe oublié</h2>
        <p className="text-gray-500 mb-6 text-sm">
          {codeSent ? "Entrez le code recu par email pour continuer." : "Entrez votre email pour recevoir un code de verification."}
        </p>
        
        {error && (
          <div className="mb-4 text-red-500 text-sm bg-red-50 p-3 rounded-xl border border-red-100">{error}</div>
        )}

        {!codeSent ? <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-xl bg-blue-50 border border-blue-100 focus:ring-2 focus:ring-blue-400 outline-none"
              placeholder="votre@email.com"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "Vérification..." : "Vérifier l'email"}
          </button>
        </form> : <form onSubmit={handleCodeSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code de verification</label>
            <input type="text" inputMode="numeric" pattern="[0-9A-Fa-f]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value)} required className="w-full px-4 py-2 rounded-xl bg-blue-50 border border-blue-100 focus:ring-2 focus:ring-blue-400 outline-none" placeholder="123ABC" />
          </div>
          <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-50">
            {loading ? "Vérification..." : "Valider le code"}
          </button>
        </form>}
      </div>
    </div>
  );
}