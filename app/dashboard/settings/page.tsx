"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { sendPasswordResetEmail, deleteUser } from "firebase/auth";
import { auth as firebaseAuth } from "@/lib/firebase";
import {
  Settings,
  User,
  Shield,
  Bell,
  Palette,
  Save,
  Check,
  Mail,
  Phone,
  MapPin,
  Building,
  Globe,
  Lock,
  Monitor,
  AlertTriangle,
  Loader2,
  Camera,
  Crown,
  CreditCard,
  Calendar,
  Key,
  FileText,
  X,
} from "lucide-react";

interface ProfileForm {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  country: string;
}

interface NotificationPrefs {
  emailNewMessages: boolean;
  emailWeeklyReport: boolean;
  emailSecurityAlerts: boolean;
  emailProductUpdates: boolean;
  emailUsageAlerts: boolean;
}

export default function SettingsPage() {
  const { user, profile, profileLoading, updateProfile, refreshProfile, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("profile");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Security state
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [securityMessage, setSecurityMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Profile form state
  const [form, setForm] = useState<ProfileForm>({
    firstName: "",
    lastName: "",
    phone: "",
    address: "",
    city: "",
    country: "",
  });

  // Notification preferences (local state)
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    emailNewMessages: true,
    emailWeeklyReport: true,
    emailSecurityAlerts: true,
    emailProductUpdates: false,
    emailUsageAlerts: true,
  });

  // Sync form with profile data
  useEffect(() => {
    if (profile) {
      setForm({
        firstName: profile.profile?.firstName || "",
        lastName: profile.profile?.lastName || "",
        phone: profile.profile?.phone || "",
        address: profile.profile?.address || "",
        city: profile.profile?.city || "",
        country: profile.profile?.country || "",
      });
    }
  }, [profile]);

  // Load notification prefs from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("twinmcp_notif_prefs");
      if (saved) setNotifPrefs(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const handleFormChange = (field: keyof ProfileForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setSaveMessage(null);
  };

  const handleNotifChange = (key: keyof NotificationPrefs) => {
    setNotifPrefs((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem("twinmcp_notif_prefs", JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
  };

  const handleSaveProfile = useCallback(async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const success = await updateProfile(form);
      if (success) {
        setSaveMessage({ type: "success", text: "Profil mis à jour avec succès !" });
        setHasChanges(false);
        await refreshProfile();
      } else {
        setSaveMessage({ type: "error", text: "Erreur lors de la mise à jour. Veuillez réessayer." });
      }
    } catch {
      setSaveMessage({ type: "error", text: "Une erreur inattendue est survenue." });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 5000);
    }
  }, [form, updateProfile, refreshProfile]);

  const tabs = [
    { id: "profile", label: "Profil", icon: User },
    { id: "account", label: "Compte", icon: Crown },
    { id: "security", label: "Sécurité", icon: Shield },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "appearance", label: "Apparence", icon: Palette },
  ];

  const userEmail = profile?.email || user?.email || "";
  const userName = profile?.name || user?.displayName || "Utilisateur";
  const userPlan = profile?.plan || "free";
  const userInitials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  const inputClass =
    "w-full px-4 py-3 bg-[#0f1020] border border-purple-500/30 rounded-xl text-white text-sm placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="w-7 h-7 text-purple-400" />
            Paramètres
          </h1>
          <p className="text-gray-400 mt-1">Personnalisez votre compte et votre expérience</p>
        </div>
        {activeTab === "profile" && (
          <div className="flex items-center gap-3">
            {saveMessage && (
              <span className={`text-sm flex items-center gap-1 ${saveMessage.type === "success" ? "text-green-400" : "text-red-400"}`}>
                {saveMessage.type === "success" ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {saveMessage.text}
              </span>
            )}
            <button
              onClick={handleSaveProfile}
              disabled={saving || !hasChanges}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold rounded-xl hover:from-purple-600 hover:to-pink-600 transition shadow-lg shadow-purple-500/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Sauvegarde..." : "Sauvegarder"}
            </button>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Sidebar Tabs */}
        <div className="lg:col-span-1">
          <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-3 sm:p-4">
            <nav className="space-y-1 flex lg:flex-col overflow-x-auto lg:overflow-x-visible scrollbar-hide">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-shrink-0 lg:w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 whitespace-nowrap ${
                      isActive
                        ? "bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-white border border-purple-500/30"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? "text-purple-400" : ""}`} />
                    <span className="text-sm font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-6">

          {/* ─── PROFILE TAB ─── */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              {/* Avatar Card */}
              <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Photo de profil</h2>
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl font-bold text-white shadow-lg shadow-purple-500/30">
                      {userInitials}
                    </div>
                    <button className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <Camera className="w-6 h-6 text-white" />
                    </button>
                  </div>
                  <div>
                    <p className="text-white font-medium">{userName}</p>
                    <p className="text-sm text-gray-400">{userEmail}</p>
                    <p className="text-xs text-gray-500 mt-2">JPG, PNG ou GIF. Max 2 Mo.</p>
                  </div>
                </div>
              </div>

              {/* Personal Info */}
              <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-white mb-1">Informations personnelles</h2>
                <p className="text-sm text-gray-400 mb-6">Ces informations sont utilisées pour personnaliser votre expérience.</p>

                {profileLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                          <User className="w-4 h-4 text-purple-400" />
                          Prénom
                        </label>
                        <input
                          type="text"
                          value={form.firstName}
                          onChange={(e) => handleFormChange("firstName", e.target.value)}
                          placeholder="Votre prénom"
                          className={inputClass}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                          <User className="w-4 h-4 text-purple-400" />
                          Nom
                        </label>
                        <input
                          type="text"
                          value={form.lastName}
                          onChange={(e) => handleFormChange("lastName", e.target.value)}
                          placeholder="Votre nom"
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <Mail className="w-4 h-4 text-purple-400" />
                        Email
                      </label>
                      <input
                        type="email"
                        value={userEmail}
                        disabled
                        className={`${inputClass} opacity-60 cursor-not-allowed`}
                      />
                      <p className="text-xs text-gray-500">L'email est lié à votre compte Firebase et ne peut pas être modifié ici.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <Phone className="w-4 h-4 text-purple-400" />
                        Téléphone
                      </label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => handleFormChange("phone", e.target.value)}
                        placeholder="+33 6 12 34 56 78"
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Address */}
              <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-white mb-1">Adresse</h2>
                <p className="text-sm text-gray-400 mb-6">Utilisée pour la facturation et les communications.</p>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                      <MapPin className="w-4 h-4 text-purple-400" />
                      Adresse
                    </label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => handleFormChange("address", e.target.value)}
                      placeholder="123 Rue de la Paix"
                      className={inputClass}
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <Building className="w-4 h-4 text-purple-400" />
                        Ville
                      </label>
                      <input
                        type="text"
                        value={form.city}
                        onChange={(e) => handleFormChange("city", e.target.value)}
                        placeholder="Paris"
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <Globe className="w-4 h-4 text-purple-400" />
                        Pays
                      </label>
                      <select
                        value={form.country}
                        onChange={(e) => handleFormChange("country", e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Sélectionnez un pays</option>
                        <option value="FR">France</option>
                        <option value="BE">Belgique</option>
                        <option value="CH">Suisse</option>
                        <option value="CA">Canada</option>
                        <option value="LU">Luxembourg</option>
                        <option value="MC">Monaco</option>
                        <option value="US">États-Unis</option>
                        <option value="GB">Royaume-Uni</option>
                        <option value="DE">Allemagne</option>
                        <option value="ES">Espagne</option>
                        <option value="IT">Italie</option>
                        <option value="PT">Portugal</option>
                        <option value="NL">Pays-Bas</option>
                        <option value="MA">Maroc</option>
                        <option value="TN">Tunisie</option>
                        <option value="DZ">Algérie</option>
                        <option value="SN">Sénégal</option>
                        <option value="CI">Côte d'Ivoire</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── ACCOUNT TAB ─── */}
          {activeTab === "account" && (
            <div className="space-y-6">
              {/* Plan Overview */}
              <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Crown className="w-5 h-5 text-yellow-400" />
                  Abonnement
                </h2>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-[#0f1020] rounded-xl border border-purple-500/20">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                        userPlan === "pro" ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" :
                        userPlan === "enterprise" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
                        "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                      }`}>
                        {userPlan === "pro" ? "Pro" : userPlan === "enterprise" ? "Enterprise" : "Gratuit"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-2">
                      {userPlan === "free"
                        ? "200 requêtes/jour — Passez au Pro pour débloquer plus de fonctionnalités."
                        : profile?.subscription?.status === "active"
                        ? "Votre abonnement est actif."
                        : "Statut de l'abonnement : " + (profile?.subscription?.status || "inconnu")}
                    </p>
                    {profile?.subscription?.currentPeriodEnd && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Prochain renouvellement : {new Date(profile.subscription.currentPeriodEnd).toLocaleDateString("fr-FR")}
                      </p>
                    )}
                  </div>
                  {userPlan === "free" && (
                    <a
                      href="/pricing"
                      className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold rounded-xl hover:from-purple-600 hover:to-pink-600 transition shadow-lg shadow-purple-500/30"
                    >
                      Passer au Pro
                    </a>
                  )}
                </div>
              </div>

              {/* Usage Stats */}
              <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Key className="w-5 h-5 text-purple-400" />
                  Utilisation
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-[#0f1020] rounded-xl text-center">
                    <p className="text-2xl font-bold text-purple-400">{profile?.stats?.apiKeysCount ?? 0}</p>
                    <p className="text-xs text-gray-400 mt-1">Clés API</p>
                  </div>
                  <div className="p-4 bg-[#0f1020] rounded-xl text-center">
                    <p className="text-2xl font-bold text-green-400">{profile?.stats?.requestsToday ?? 0}</p>
                    <p className="text-xs text-gray-400 mt-1">Requêtes aujourd'hui</p>
                  </div>
                  <div className="p-4 bg-[#0f1020] rounded-xl text-center">
                    <p className="text-2xl font-bold text-blue-400">{profile?.stats?.requestsMonth ?? 0}</p>
                    <p className="text-xs text-gray-400 mt-1">Requêtes ce mois</p>
                  </div>
                </div>
              </div>

              {/* Account Info */}
              <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-400" />
                  Informations du compte
                </h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-[#0f1020] rounded-xl">
                    <span className="text-sm text-gray-400">ID Client</span>
                    <code className="text-sm text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">{profile?.clientId || "—"}</code>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-[#0f1020] rounded-xl">
                    <span className="text-sm text-gray-400">Rôle</span>
                    <span className="text-sm text-white capitalize">{profile?.role?.toLowerCase() || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-[#0f1020] rounded-xl">
                    <span className="text-sm text-gray-400">Email</span>
                    <span className="text-sm text-white">{userEmail}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── SECURITY TAB ─── */}
          {activeTab === "security" && (
            <div className="space-y-6">
              <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-white mb-1">Sécurité du compte</h2>
                <p className="text-sm text-gray-400 mb-6">Protégez votre compte et vos données.</p>

                <div className="space-y-4">
                  {securityMessage && (
                    <div className={`p-4 rounded-xl flex items-center gap-3 ${securityMessage.type === "success" ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/30"}`}>
                      {securityMessage.type === "success" ? <Check className="w-5 h-5 text-green-400 flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />}
                      <p className={`text-sm ${securityMessage.type === "success" ? "text-green-400" : "text-red-400"}`}>{securityMessage.text}</p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-[#0f1020] rounded-xl border border-purple-500/20 hover:border-purple-500/40 transition">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                        <Lock className="w-6 h-6 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">Changer le mot de passe</h3>
                        <p className="text-sm text-gray-400 mt-1">
                          {passwordResetSent
                            ? "Un email de réinitialisation a été envoyé. Vérifiez votre boîte de réception."
                            : "Un email de réinitialisation sera envoyé à votre adresse."}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!firebaseAuth || !user?.email) return;
                        setPasswordResetLoading(true);
                        setSecurityMessage(null);
                        try {
                          await sendPasswordResetEmail(firebaseAuth, user.email);
                          setPasswordResetSent(true);
                          setSecurityMessage({ type: "success", text: "Email de réinitialisation envoyé !" });
                        } catch (err: any) {
                          setSecurityMessage({ type: "error", text: err.message || "Erreur lors de l'envoi" });
                        } finally {
                          setPasswordResetLoading(false);
                          setTimeout(() => setSecurityMessage(null), 5000);
                        }
                      }}
                      disabled={passwordResetLoading || passwordResetSent}
                      className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-medium rounded-xl transition disabled:opacity-50 flex items-center gap-2"
                    >
                      {passwordResetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : passwordResetSent ? <Check className="w-4 h-4" /> : null}
                      {passwordResetSent ? "Envoyé" : "Modifier"}
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-[#0f1020] rounded-xl border border-purple-500/20 hover:border-purple-500/40 transition">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                        <Monitor className="w-6 h-6 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">Sessions actives</h3>
                        <p className="text-sm text-gray-400 mt-1">Déconnectez-vous de tous les appareils.</p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          await logout();
                          router.push("/auth");
                        } catch { /* ignore */ }
                      }}
                      className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-medium rounded-xl transition"
                    >
                      Tout déconnecter
                    </button>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="bg-[#1a1b2e] border border-red-500/30 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                  <h2 className="text-lg font-semibold text-red-400">Zone de danger</h2>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  La suppression de votre compte est irréversible. Toutes vos données, clés API et configurations seront définitivement perdues.
                </p>
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-5 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium rounded-xl transition border border-red-500/30"
                  >
                    Supprimer mon compte
                  </button>
                ) : (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl space-y-3">
                    <p className="text-sm text-red-300">
                      Tapez <strong className="text-red-400">SUPPRIMER</strong> pour confirmer la suppression définitive de votre compte.
                    </p>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="Tapez SUPPRIMER"
                      className="w-full px-4 py-2.5 bg-[#0f1020] border border-red-500/30 rounded-xl text-white text-sm placeholder-gray-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                        className="px-4 py-2 text-gray-400 hover:text-white text-sm transition"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={async () => {
                          if (deleteConfirmText !== "SUPPRIMER") return;
                          setDeleteLoading(true);
                          try {
                            if (firebaseAuth?.currentUser) {
                              await deleteUser(firebaseAuth.currentUser);
                            }
                            await logout();
                            router.push("/auth");
                          } catch (err: any) {
                            if (err.code === "auth/requires-recent-login") {
                              setSecurityMessage({ type: "error", text: "Veuillez vous reconnecter avant de supprimer votre compte (sécurité Firebase)." });
                            } else {
                              setSecurityMessage({ type: "error", text: err.message || "Erreur lors de la suppression" });
                            }
                            setShowDeleteConfirm(false);
                            setDeleteConfirmText("");
                          } finally {
                            setDeleteLoading(false);
                          }
                        }}
                        disabled={deleteConfirmText !== "SUPPRIMER" || deleteLoading}
                        className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-xl transition disabled:opacity-50 flex items-center gap-2"
                      >
                        {deleteLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Confirmer la suppression
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── NOTIFICATIONS TAB ─── */}
          {activeTab === "notifications" && (
            <div className="space-y-6">
              <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-white mb-1">Préférences de notification</h2>
                <p className="text-sm text-gray-400 mb-6">Choisissez les notifications que vous souhaitez recevoir.</p>

                <div className="space-y-3">
                  {([
                    { key: "emailNewMessages" as const, title: "Nouveaux messages", desc: "Notifications pour les nouveaux messages et réponses", icon: Mail },
                    { key: "emailWeeklyReport" as const, title: "Rapports hebdomadaires", desc: "Résumé de l'activité de vos serveurs MCP", icon: FileText },
                    { key: "emailSecurityAlerts" as const, title: "Alertes de sécurité", desc: "Connexions suspectes et changements de mot de passe", icon: Shield },
                    { key: "emailUsageAlerts" as const, title: "Alertes d'utilisation", desc: "Notification quand vous approchez de votre limite", icon: AlertTriangle },
                    { key: "emailProductUpdates" as const, title: "Mises à jour produit", desc: "Nouvelles fonctionnalités et améliorations", icon: Settings },
                  ]).map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.key} className="flex items-center justify-between gap-4 p-4 bg-[#0f1020] rounded-xl border border-purple-500/20 hover:border-purple-500/40 transition">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-5 h-5 text-purple-400" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-medium text-white text-sm">{item.title}</h3>
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{item.desc}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleNotifChange(item.key)}
                          className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
                            notifPrefs[item.key] ? "bg-gradient-to-r from-purple-500 to-pink-500" : "bg-gray-700"
                          }`}
                        >
                          <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                            notifPrefs[item.key] ? "translate-x-[22px]" : "translate-x-0.5"
                          }`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ─── APPEARANCE TAB ─── */}
          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-white mb-1">Thème</h2>
                <p className="text-sm text-gray-400 mb-6">Choisissez l'apparence de votre interface.</p>

                <div className="grid grid-cols-3 gap-4">
                  {[
                    { name: "Clair", gradient: "from-gray-100 to-gray-200", active: false },
                    { name: "Sombre", gradient: "from-gray-800 to-gray-900", active: false },
                    { name: "TwinMCP", gradient: "from-purple-600 to-pink-500", active: true },
                  ].map((theme) => (
                    <button
                      key={theme.name}
                      className={`relative p-4 rounded-xl border-2 transition-all ${
                        theme.active
                          ? "border-purple-500 shadow-lg shadow-purple-500/20"
                          : "border-purple-500/20 hover:border-purple-500/40 opacity-50 cursor-not-allowed"
                      }`}
                      disabled={!theme.active}
                    >
                      <div className={`w-full h-16 rounded-lg bg-gradient-to-br ${theme.gradient} mb-3`} />
                      <p className="font-medium text-center text-sm text-white">{theme.name}</p>
                      {theme.active && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                      {!theme.active && (
                        <span className="absolute top-2 right-2 text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">Bientôt</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-white mb-1">Langue & Région</h2>
                <p className="text-sm text-gray-400 mb-6">Paramètres de localisation.</p>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                      <Globe className="w-4 h-4 text-purple-400" />
                      Langue de l'interface
                    </label>
                    <select className={inputClass}>
                      <option value="fr">Français</option>
                      <option value="en">English</option>
                      <option value="es">Español</option>
                      <option value="de">Deutsch</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between gap-4 p-4 bg-[#0f1020] rounded-xl border border-purple-500/20">
                    <div>
                      <h3 className="font-medium text-white text-sm">Animations réduites</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Désactiver les animations pour de meilleures performances.</p>
                    </div>
                    <button className="relative w-12 h-7 rounded-full bg-gray-700 transition-colors flex-shrink-0">
                      <div className="absolute top-0.5 translate-x-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}