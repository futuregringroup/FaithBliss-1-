// src/pages/Settings.tsx

import { useState } from 'react';
import { ArrowLeft, Bell, Mail, Shield, Sliders, Smartphone, Save, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { TopBar } from '@/components/dashboard/TopBar';
import { SidePanel } from '@/components/dashboard/SidePanel';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { API } from '@/services/api';
import { getSubscriptionTierLabel } from '@/constants/subscriptionPlans';

const SettingsContent = () => {
  const { user, deleteAccount } = useAuthContext();
  const { showError, showSuccess } = useToast();
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    emailNotifications: user?.settings?.emailNotifications ?? true,
    pushNotifications: user?.settings?.pushNotifications ?? true,
    matchAlerts: user?.settings?.matchAlerts ?? true,
    messageAlerts: user?.settings?.messageAlerts ?? true,
  });
  const [reactivating, setReactivating] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const layoutName = user?.name || 'User';
  const layoutImage = user?.profilePhoto1 || undefined;
  const layoutUser = user || null;
  const isPremium = user?.subscriptionStatus === 'active' && ['premium', 'elite'].includes(user?.subscriptionTier || '');
  const activeTier = user?.subscriptionTier || 'free';
  const activeTierLabel = getSubscriptionTierLabel(activeTier);

  const handleToggle = (key: keyof typeof form) => {
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await API.User.updateSettings(form);
      showSuccess('Settings saved successfully.');
    } catch (error: any) {
      showError(error?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleReactivate = async () => {
    try {
      setReactivating(true);
      await API.User.reactivateAccount();
      showSuccess('Account reactivated successfully.');
    } catch (error: any) {
      showError(error?.message || 'Failed to reactivate account.');
    } finally {
      setReactivating(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    try {
      setIsDeleting(true);
      await deleteAccount();
    } catch {
      showError('Failed to delete account. Please try again.');
      setIsDeleting(false);
    }
  };

  const mainContent = (
    <>
    <div className="px-4 py-8 sm:px-6 lg:px-12">
      <div className="max-w-4xl space-y-8">
        <div className="flex items-center justify-start">
          <Link
            to="/dashboard"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15"
            aria-label="Back to dashboard"
            title="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>

        <div className="rounded-3xl border border-white/8 bg-white/4 p-6 shadow-[0_4px_24px_rgba(2,6,23,0.3)]">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-pink-500/20 p-3 text-pink-200">
              <Sliders className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Preferences</h2>
              <p className="text-sm text-gray-300">Choose how you want to hear from FaithBliss.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              { key: 'emailNotifications', label: 'Email notifications', icon: Mail, iconBg: 'bg-blue-500/20', iconColor: 'text-blue-300' },
              { key: 'pushNotifications', label: 'Browser notifications', icon: Smartphone, iconBg: 'bg-violet-500/20', iconColor: 'text-violet-300' },
              { key: 'matchAlerts', label: 'New match alerts', icon: Bell, iconBg: 'bg-pink-500/20', iconColor: 'text-pink-300' },
              { key: 'messageAlerts', label: 'New message alerts', icon: Shield, iconBg: 'bg-emerald-500/20', iconColor: 'text-emerald-300' },
            ].map(({ key, label, icon: Icon, iconBg, iconColor }) => (
              <button
                key={key}
                onClick={() => handleToggle(key as keyof typeof form)}
                className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/4 p-4 text-left transition hover:border-pink-500/30 hover:bg-white/8"
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl p-2 ${iconBg}`}>
                    <Icon className={`h-5 w-5 ${iconColor}`} />
                  </div>
                  <span className="text-sm font-medium text-white">{label}</span>
                </div>
                <span
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    form[key as keyof typeof form] ? 'bg-gradient-to-r from-pink-500 to-purple-600' : 'bg-white/15'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${
                      form[key as keyof typeof form] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </span>
              </button>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 px-6 py-3 text-sm font-semibold text-white transition hover:from-pink-400 hover:to-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save settings'}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/8 bg-white/4 p-6 shadow-[0_4px_24px_rgba(2,6,23,0.3)]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Subscription</h3>
              <p className="text-sm text-gray-300">
                {isPremium ? `Active ${activeTierLabel}` : 'Free plan'}
              </p>
            </div>
            <span className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${
              isPremium
                ? 'bg-gradient-to-r from-pink-500/80 to-purple-600/80 text-white shadow-[0_4px_14px_rgba(236,72,153,0.25)]'
                : 'border border-white/10 bg-white/5 text-gray-400'
            }`}>
              {isPremium ? 'Premium' : 'Free'}
            </span>
          </div>

          {user?.isActive === false && (
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4">
              <div>
                <p className="text-sm font-semibold text-white">Account is deactivated</p>
                <p className="text-xs text-gray-300">Reactivate to return to matching.</p>
              </div>
              <button
                onClick={handleReactivate}
                disabled={reactivating}
                className="rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-4 py-2 text-xs font-semibold text-white transition hover:from-orange-400 hover:to-pink-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {reactivating ? 'Reactivating...' : 'Reactivate'}
              </button>
            </div>
          )}
        </div>

        {/* Danger zone */}
        <div className="danger-zone p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-red-500/15 p-2.5">
              <Shield className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Account Actions</h3>
              <p className="text-xs text-gray-400">Irreversible or sensitive actions</p>
            </div>
          </div>
          <div className="space-y-3">
            <Link
              to="/deactivate"
              className="flex items-center justify-between rounded-2xl border border-red-500/15 bg-red-500/5 p-4 text-sm font-medium text-red-300 transition hover:bg-red-500/10 hover:border-red-500/25"
            >
              <span>Deactivate account</span>
              <ArrowLeft className="h-4 w-4 rotate-180 opacity-50" />
            </Link>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex w-full items-center justify-between rounded-2xl border border-red-600/30 bg-red-600/10 p-4 text-sm font-medium text-red-400 transition hover:bg-red-600/20 hover:border-red-600/40"
            >
              <span>Delete account permanently</span>
              <Trash2 className="h-4 w-4 opacity-60" />
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Delete Account Confirmation Modal */}
    {showDeleteModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !isDeleting && setShowDeleteModal(false)} />
        <div className="relative w-full max-w-md rounded-3xl border border-red-500/20 bg-slate-900 p-6 shadow-2xl">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-red-500/15 p-2.5">
              <Trash2 className="h-5 w-5 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Delete Account</h3>
          </div>
          <p className="mb-2 text-sm text-gray-300">
            This action is <span className="font-semibold text-red-400">permanent and irreversible</span>. Your profile, matches, and all data will be deleted immediately.
          </p>
          <p className="mb-4 text-sm text-gray-400">
            Type <span className="font-mono font-bold text-white">DELETE</span> below to confirm.
          </p>
          <input
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="Type DELETE to confirm"
            disabled={isDeleting}
            className="mb-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-red-500/50 focus:outline-none disabled:opacity-50"
          />
          <div className="flex gap-3">
            <button
              onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
              disabled={isDeleting}
              className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== 'DELETE' || isDeleting}
              className="flex-1 rounded-full bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isDeleting ? 'Deleting...' : 'Delete forever'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-gray-900 to-slate-950 text-white overflow-x-hidden pb-[calc(var(--nav-height,88px)+max(1rem,env(safe-area-inset-bottom)))] no-horizontal-scroll dashboard-main">
      <div className="hidden lg:flex min-h-screen">
        <div className="w-80 flex-shrink-0">
          <SidePanel userName={layoutName} userImage={layoutImage} user={layoutUser} onClose={() => setShowSidePanel(false)} />
        </div>
        <div className="flex-1 flex flex-col min-h-screen">
          <TopBar
            userName={layoutName}
            userImage={layoutImage}
            user={layoutUser}
            showFilters={false}
            showSidePanel={showSidePanel}
            onToggleFilters={() => {}}
            onToggleSidePanel={() => setShowSidePanel(false)}
            title="Settings"
          />
          <div className="flex-1 overflow-y-auto">{mainContent}</div>
        </div>
      </div>

      <div className="lg:hidden min-h-screen">
        <TopBar
          userName={layoutName}
          userImage={layoutImage}
          user={layoutUser}
          showFilters={false}
          showSidePanel={showSidePanel}
          onToggleFilters={() => {}}
          onToggleSidePanel={() => setShowSidePanel(true)}
          title="Settings"
        />
        <div className="flex-1">{mainContent}</div>
      </div>

      {showSidePanel && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowSidePanel(false)} />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw]">
            <SidePanel userName={layoutName} userImage={layoutImage} user={layoutUser} onClose={() => setShowSidePanel(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default function ProtectedSettings() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}
