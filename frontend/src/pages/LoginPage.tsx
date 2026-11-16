

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await login(email, password);
      
      // Handle first login / mandatory password change
      if (data.mustChangePassword) {
        // Redirect to the reset password page and pass the email in the state
        navigate("/reset-password", { state: { email: email } });
        return;
      }

      setRole(data.user.role);
      if (data.user.role === "TECHNICO") {
        navigate("/technico");
      } else if (data.user.role === "SOUS_TRAITANT") {
        navigate("/fournisseur");
      } else {
        navigate("/admin");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  // Branding dynamique selon le rôle détecté après connexion
  const branding = role === "technicien" || role === "TECHNICO"
    ? {
        bg: "bg-blue-50",
        title: "BÂTIFLOW",
        subtitle: "CRM Bâtiment Intelligent",
        stats: [
          { label: "Clients gérés", value: "500+" },
          { label: "Devis créés", value: "1200+" },
          { label: "Satisfaction", value: "98%" },
        ],
      }
    : {
        bg: "bg-gradient-to-tr from-blue-900 via-blue-700 to-blue-400",
        title: "BÂTIFLOW",
        subtitle: "CRM Bâtiment Intelligent",
        stats: [
          { label: "Clients", value: "500+" },
          { label: "Devis", value: "1200+" },
          { label: "Satisfaction", value: "98%" },
        ],
      };

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 py-8 ${branding.bg}`}>
      <div className="flex w-full max-w-4xl overflow-hidden rounded-3xl shadow-2xl">
        {/* LEFT SIDE (Branding) */}
        <div className="hidden flex-col items-center justify-center bg-gradient-to-br from-blue-900 via-blue-700 to-blue-500 px-8 py-12 text-white md:flex md:w-[45%]">
          <h1 className="mb-2 text-3xl font-extrabold">{branding.title}</h1>
          <p className="mb-6 text-center text-sm opacity-80">{branding.subtitle}</p>
          <div className="flex gap-4">
            {branding.stats.map((stat, i) => (
              <div className="text-center" key={i}>
                <div className="text-xl font-bold">{stat.value}</div>
                <div className="text-xs">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
        {/* RIGHT SIDE (Form) */}
        <div className="flex flex-1 flex-col justify-center bg-gray-50 p-6 md:p-10">
          <div className="mx-auto w-full max-w-sm">
            <h2 className="text-2xl font-bold text-blue-900 mb-2">Bienvenue 👋</h2>
            <p className="text-blue-400 mb-6">Connectez-vous à votre espace</p>
            {error && (
              <div className="mb-4 text-red-500 text-sm bg-red-100 p-2 rounded">{error}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* EMAIL */}
              <div>
                <label className="block text-blue-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 rounded-xl bg-blue-100 border border-blue-200 focus:ring-2 focus:ring-blue-400 outline-none"
                  placeholder="admin@batiment.com"
                />
              </div>
              {/* PASSWORD */}
              <div>
                <label className="block text-blue-700 mb-1">Mot de passe</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-2 rounded-xl bg-blue-100 border border-blue-200 focus:ring-2 focus:ring-blue-400 outline-none"
                    placeholder="••••••••"
                  />
                  <span
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                  >
                    👁️
                  </span>
                </div>
              </div>
              {/* OPTIONS */}
              <div className="flex justify-between items-center text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" /> Se souvenir de moi
                </label>
                <span 
                  onClick={() => navigate("/forgot-password")}
                  className="text-blue-600 cursor-pointer hover:underline"
                >
                  Mot de passe oublié ?
                </span>
              </div>
              {/* BUTTON */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
              >
                {loading ? "Connexion..." : "Se connecter"}
              </button>
            </form>
            <div className="mt-6 text-center text-xs text-gray-400">
              BÂTIFLOW v1.0 - Plateforme sécurisée
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
