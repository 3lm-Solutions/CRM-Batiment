

export default function LoginPageTechnicien() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      <div className="flex w-full max-w-5xl bg-white/80 rounded-3xl shadow-xl overflow-hidden">
        {/* Bloc gauche (branding) */}
        <div className="hidden md:flex flex-col items-center justify-center w-1/2 bg-gradient-to-br from-blue-100 via-blue-200 to-blue-300 p-12">
          <div className="flex flex-col items-center">
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
              {/* Icône bâtiment (remplacer par un vrai svg si besoin) */}
              <svg width="48" height="48" fill="none" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#e0e7ff"/><path d="M16 36V20h16v16" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M20 36V28h8v8" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <h1 className="text-4xl font-extrabold text-blue-700 mb-2 tracking-tight">BÂTIFLOW</h1>
            <h2 className="text-xl font-semibold text-blue-500 mb-2">CRM Bâtiment Intelligent</h2>
            <p className="text-blue-400 text-center max-w-xs mb-8">Gérez vos clients, devis et chantiers en toute simplicité grâce à une plateforme moderne et performante.</p>
            <div className="flex gap-6 mt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-700">500+</div>
                <div className="text-xs text-blue-400">Clients gérés</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-700">1200+</div>
                <div className="text-xs text-blue-400">Devis créés</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-700">98%</div>
                <div className="text-xs text-blue-400">Satisfaction</div>
              </div>
            </div>
          </div>
        </div>
        {/* Bloc droit (formulaire) */}
        <div className="flex-1 flex flex-col justify-center p-8 md:p-16">
          <div className="w-full max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-blue-800 mb-2 flex items-center gap-2">Bienvenue <span>👋</span></h2>
            <p className="text-blue-400 mb-8">Connectez-vous pour accéder à votre espace</p>
            <form className="space-y-6">
              <div>
                <label className="block text-blue-700 font-medium mb-1">Email</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400">
                    <svg width="20" height="20" fill="none" viewBox="0 0 20 20"><path d="M2.5 5.5l7.5 5 7.5-5" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="2.5" y="5.5" width="15" height="9" rx="2" stroke="#60a5fa" strokeWidth="1.5"/></svg>
                  </span>
                  <input type="email" className="w-full pl-10 pr-4 py-2 rounded-xl bg-blue-100 text-blue-900 placeholder-blue-400 border border-blue-200 focus:ring-2 focus:ring-blue-400 outline-none transition" placeholder="admin@batiment-pro.fr" />
                </div>
              </div>
              <div>
                <label className="block text-blue-700 font-medium mb-1">Mot de passe</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400">
                    <svg width="20" height="20" fill="none" viewBox="0 0 20 20"><rect x="3" y="8" width="14" height="7" rx="2" stroke="#60a5fa" strokeWidth="1.5"/><path d="M7 8V6a3 3 0 1 1 6 0v2" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </span>
                  <input type="password" className="w-full pl-10 pr-10 py-2 rounded-xl bg-blue-100 text-blue-900 placeholder-blue-400 border border-blue-200 focus:ring-2 focus:ring-blue-400 outline-none transition" placeholder="••••••••" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 cursor-pointer">
                    <svg width="20" height="20" fill="none" viewBox="0 0 20 20"><path d="M1.458 10.042C2.324 6.942 5.455 4.5 10 4.5c4.545 0 7.676 2.442 8.542 5.542a1.25 1.25 0 0 1 0 .916C17.676 13.058 14.545 15.5 10 15.5c-4.545 0-7.676-2.442-8.542-5.542a1.25 1.25 0 0 1 0-.916Z" stroke="#60a5fa" strokeWidth="1.5"/><circle cx="10" cy="10" r="2.5" stroke="#60a5fa" strokeWidth="1.5"/></svg>
                  </span>
                </div>
              </div>
              <button type="submit" className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md transition">Se connecter</button>
            </form>
            <div className="mt-8 text-center text-xs text-blue-300">Plateforme sécurisée · BÂTIFLOW v1.0</div>
          </div>
        </div>
      </div>
    </div>
  );
}
