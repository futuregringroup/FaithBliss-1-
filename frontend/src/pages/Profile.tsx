/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/Profile.tsx
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useUserProfile } from '@/hooks/useAPI';
import { API } from '@/services/api';
import ProfileHeader from '@/components/profile/ProfileHeader';
import { TopBar } from '@/components/dashboard/TopBar';
import { SidePanel } from '@/components/dashboard/SidePanel';
import { useAuthContext } from '@/contexts/AuthContext';
import ProfileTabs, { type TabSection } from '@/components/profile/ProfileTabs';
import PhotosSection from '@/components/profile/PhotosSection';
import BasicInfoSection from '@/components/profile/BasicInfoSection';
import PassionsSection from '@/components/profile/PassionsSection';
import FaithSection from '@/components/profile/FaithSection';
import ManageSubscriptionSection from '@/components/profile/ManageSubscriptionSection';
import SaveButton from '@/components/profile/SaveButton';
import type { ProfileData } from '@/types/profile';
import type { UpdateProfileDto } from '@/services/api';
import { updateProfileClient, uploadSpecificPhotoClient } from '@/services/api-client';
import { analyzePhotoFaces, validatePhotoFileBasics } from '@/utils/photoValidation';
import { MIN_PROFILE_FITS, PROFILE_FIT_OPTIONS } from '@/constants/profileFitOptions';
import { getSubscriptionTierLabel } from '@/constants/subscriptionPlans';
import { useSubscriptionDisplay } from '@/hooks/useSubscriptionDisplay';
import { Clock3, Crown, Sparkles } from 'lucide-react';

const ProfilePage: React.FC = () => {
  const { accessToken, user: authUser } = useAuthContext();
  const subscriptionDisplay = useSubscriptionDisplay(authUser);

  // âœ… Use only valid id/email from your User type
  const currentUserId = authUser?.id;
  const currentUserEmail = authUser?.email;

  const { data: userData, loading, execute } = useUserProfile(currentUserId, currentUserEmail);

  const [searchParams, setSearchParams] = useSearchParams();
  // Deep-link target from ProfileCompletionBanner ("?focus=interests|bio"):
  // open the right tab on first mount and scroll to the corresponding section.
  const focusParam = searchParams.get('focus');
  const initialSection: TabSection =
    focusParam === 'interests' ? 'passions' : focusParam === 'bio' ? 'basics' : 'photos';

  const [activeSection, setActiveSection] = useState<TabSection>(initialSection);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [showSidePanel, setShowSidePanel] = useState(false);

  // Once profileData is populated (section content is mounted), scroll to the
  // requested anchor and strip the query param so subsequent navigation isn't
  // hijacked by a stale focus.
  useEffect(() => {
    if (!focusParam || !profileData) return;
    const target = focusParam === 'interests' ? 'interests' : focusParam === 'bio' ? 'bio' : null;
    if (!target) return;

    const frame = window.requestAnimationFrame(() => {
      const node = document.querySelector(`[data-profile-focus="${target}"]`);
      if (node instanceof HTMLElement) {
        node.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('focus');
      setSearchParams(nextParams, { replace: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusParam, profileData, searchParams, setSearchParams]);

  const toArray = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.filter((item) => typeof item === 'string' && item.trim().length > 0);
    if (typeof value === 'string' && value.trim()) return [value.trim()];
    return [];
  };

  useEffect(() => {
    let resolved = userData as any;

    if (Array.isArray(userData)) {
      resolved =
        userData.find((u: any) => u.id === currentUserId) ||
        userData.find((u: any) => u.email?.toLowerCase() === currentUserEmail?.toLowerCase()) ||
        userData[0] ||
        null;
    }

    const user = resolved;
    if (!user) {
      return;
    }

    const mergedHobbies = Array.isArray(user.hobbies) && user.hobbies.length > 0
      ? user.hobbies
      : Array.isArray(user.interests)
        ? user.interests
        : [];
    const mergedInterests = Array.isArray(user.interests) && user.interests.length > 0
      ? user.interests
      : Array.isArray(user.hobbies)
        ? user.hobbies
        : [];

    const mergedLookingFor = Array.isArray(user.lookingFor) && user.lookingFor.length > 0
      ? user.lookingFor
      : Array.isArray(user.relationshipGoals)
        ? user.relationshipGoals
        : [];

    setProfileData({
      id: user.id || '',
      email: user.email || '',
      name: user.name || '',
      gender: user.gender || undefined,
      age: user.age ?? 0,
      denomination: user.denomination || undefined,
      bio: user.bio || '',
      location: {
        address: user.location || '',
        latitude: user.latitude ?? null,
        longitude: user.longitude ?? null,
      },
      phoneNumber: user.phoneNumber || '',
      countryCode: user.countryCode || '',
      birthday: user.birthday || '',
      fieldOfStudy: user.fieldOfStudy || user.education || '',
      profession: user.profession || user.occupation || '',
      faithJourney: user.faithJourney || undefined,
      sundayActivity: user.sundayActivity || undefined,
      churchAttendance: user.churchAttendance || undefined,
      baptismStatus: user.baptismStatus || undefined,
      spiritualGifts: user.spiritualGifts || [],
      lookingFor: mergedLookingFor,
      hobbies: mergedHobbies,
      interests: mergedInterests,
      values: user.values || [],
      profileFits: user.profileFits || [],
      favoriteVerse: user.favoriteVerse || '',
      drinkingHabit: user.drinkingHabit || '',
      smokingHabit: user.smokingHabit || '',
      workoutHabit: user.workoutHabit || '',
      petPreference: user.petPreference || '',
      height: user.height || '',
      language: user.language || (Array.isArray(user.languageSpoken) ? user.languageSpoken[0] : '') || '',
      languageSpoken: toArray(user.languageSpoken),
      personalPromptQuestion: user.personalPromptQuestion || '',
      personalPromptAnswer: user.personalPromptAnswer || '',
      communicationStyle: toArray(user.communicationStyle),
      loveStyle: toArray(user.loveStyle),
      educationLevel: user.educationLevel || '',
      zodiacSign: user.zodiacSign || '',
      photos: [
        user.profilePhoto1 || null,
        user.profilePhoto2 || null,
        user.profilePhoto3 || null,
        user.profilePhoto4 || null,
        user.profilePhoto5 || null,
        user.profilePhoto6 || null,
      ],
      isVerified: user.isVerified || false,
      onboardingCompleted: user.onboardingCompleted || false,
      preferences: user.preferences || undefined,
    });
  }, [userData, currentUserId, currentUserEmail]);

  // âœ… Save handler
  const handleSave = async () => {
    if (!profileData || !accessToken) return;
    if (!Array.isArray(profileData.profileFits) || profileData.profileFits.length < MIN_PROFILE_FITS) {
      setSaveMessage(`Pick at least ${MIN_PROFILE_FITS} options in "Which fits you best" before saving.`);
      setTimeout(() => setSaveMessage(''), 3000);
      return;
    }
    setIsSaving(true);
    try {
      const updatePayload: UpdateProfileDto = {
        name: profileData.name,
        gender: profileData.gender,
        age: profileData.age,
        bio: profileData.bio,
        denomination: profileData.denomination as any,
        favoriteVerse: profileData.favoriteVerse,
        faithJourney: profileData.faithJourney as any,
        churchAttendance: profileData.churchAttendance as any,
        sundayActivity: (profileData.churchAttendance || profileData.sundayActivity) as any,
        baptismStatus: profileData.baptismStatus as any,
        spiritualGifts: profileData.spiritualGifts || [],
        lookingFor: profileData.lookingFor,
        hobbies: profileData.interests || profileData.hobbies,
        interests: profileData.interests || profileData.hobbies,
        values: profileData.values,
        profileFits: profileData.profileFits,
        drinkingHabit: profileData.drinkingHabit,
        smokingHabit: profileData.smokingHabit,
        workoutHabit: profileData.workoutHabit,
        petPreference: profileData.petPreference,
        height: profileData.height,
        language: profileData.language || (Array.isArray(profileData.languageSpoken) ? profileData.languageSpoken[0] : ''),
        languageSpoken: Array.isArray(profileData.languageSpoken) ? profileData.languageSpoken : [],
        personalPromptQuestion: profileData.personalPromptQuestion,
        personalPromptAnswer: profileData.personalPromptAnswer,
        communicationStyle: profileData.communicationStyle,
        loveStyle: profileData.loveStyle,
        educationLevel: profileData.educationLevel,
        zodiacSign: profileData.zodiacSign,
        location: profileData.location?.address || undefined,
        latitude: profileData.location?.latitude ?? undefined,
        longitude: profileData.location?.longitude ?? undefined,
        fieldOfStudy: profileData.fieldOfStudy,
        profession: profileData.profession,
      };

      await updateProfileClient(updatePayload, accessToken);
      setSaveMessage('Profile saved successfully!');
      if (execute) await execute();
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
      setSaveMessage('Error saving profile. Please try again.');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  // âœ… Photo upload handler
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>, slotIndex: number) => {
    const file = event.target.files?.[0];
    if (!file || !profileData || !accessToken) return;
    setIsSaving(true);
    try {
      const basicValidationError = validatePhotoFileBasics(file);
      if (basicValidationError) {
        setSaveMessage(basicValidationError);
        setTimeout(() => setSaveMessage(''), 3000);
        return;
      }

      const faceAnalysis = await analyzePhotoFaces(file);
      if (slotIndex === 0 && faceAnalysis.supported && faceAnalysis.faceCount !== 1) {
        setSaveMessage('Primary photo must contain one clear face. Upload a clear solo photo.');
        setTimeout(() => setSaveMessage(''), 3500);
        return;
      }

      const formData = new FormData();
      formData.append('photo', file);

      const photoNumber = slotIndex + 1;

      const response = await uploadSpecificPhotoClient(photoNumber, formData, accessToken);
      const photoUrl = response?.photoUrl || response?.url || response?.data?.photoUrl;

      const updatedPhotosArray = [...(profileData.photos || [])];
      updatedPhotosArray[slotIndex] = photoUrl;
      setProfileData(prev => (prev ? { ...prev, photos: updatedPhotosArray } : null));

      if (slotIndex > 0 && faceAnalysis.supported && (faceAnalysis.faceCount ?? 0) > 1) {
        setSaveMessage('Photo uploaded. Tip: solo photos get better match engagement.');
      } else {
        setSaveMessage('Photo uploaded successfully!');
      }
      if (execute) await execute();
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error('Error uploading photo:', err);
      setSaveMessage('Error uploading photo. Please try again.');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setIsSaving(false);
      event.target.value = '';
    }
  };

  // âœ… Remove photo
  const removePhoto = async (index: number) => {
    if (!profileData || !accessToken) return;
    setIsSaving(true);
    try {
      const photoNumberToRemove = index + 1;
      await API.User.deletePhoto(photoNumberToRemove);

      const updatedPhotosArray = [...(profileData.photos || [])];
      updatedPhotosArray[index] = null;
      setProfileData(prev => (prev ? { ...prev, photos: updatedPhotosArray } : null));
      setSaveMessage('Photo removed successfully!');
      if (execute) await execute();
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error('Error removing photo:', err);
      setSaveMessage('Error removing photo. Please try again.');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500" />
        <p className="ml-4 text-lg">Loading profile...</p>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-h-screen text-white p-6">
        <ProfileHeader />
        <div className="max-w-4xl mx-auto p-4">
          <p className="text-lg text-yellow-300">
            We couldn't load your profile yet. Please refresh or complete onboarding.
          </p>
        </div>
      </div>
    );
  }

  const layoutUser = authUser;
  const layoutName = layoutUser?.name || profileData?.name || 'User';
  const layoutImage = layoutUser?.profilePhoto1 || profileData?.photos?.[0] || undefined;
  const isPremium = layoutUser?.subscriptionStatus === 'active' && ['premium', 'elite'].includes(layoutUser?.subscriptionTier || '');
  const activeTier = layoutUser?.subscriptionTier || 'free';
  const activeTierLabel = getSubscriptionTierLabel(activeTier);

  const content = (
    <>
      <ProfileHeader />
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className={`rounded-[2rem] border p-5 shadow-[0_18px_40px_rgba(2,6,23,0.18)] ${
          isPremium
            ? 'border-yellow-400/25 bg-gradient-to-br from-yellow-500/15 via-pink-500/10 to-transparent'
            : 'border-white/10 bg-white/5'
        }`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">Current plan</p>
              <div className="mt-2 flex items-center gap-2">
                {isPremium ? (
                  <Crown className="h-5 w-5 text-yellow-300" />
                ) : (
                  <Sparkles className="h-5 w-5 text-slate-300" />
                )}
                <h2 className="text-xl font-semibold text-white">
                  {subscriptionDisplay.tierLabel}
                </h2>
              </div>
              <p className="mt-2 text-sm text-gray-300">
                {isPremium
                  ? `${activeTierLabel} subscriber with premium matching benefits active.`
                  : 'You are currently on the free plan.'}
              </p>
              <button
                type="button"
                onClick={() => setActiveSection('subscription')}
                className="mt-4 inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/90 transition hover:border-white/30 hover:bg-white/10"
              >
                Manage subscription
              </button>
            </div>

            <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${
              isPremium
                ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'
                : 'border-white/10 bg-white/5 text-gray-300'
            }`}>
              {subscriptionDisplay.statusLabel}
            </div>
          </div>

          {isPremium ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">Countdown</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {subscriptionDisplay.countdownLabel || 'Monthly renewal active'}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                  <Clock3 className="h-3.5 w-3.5" />
                  Next renewal
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {subscriptionDisplay.renewalLabel || 'Auto-renewing monthly'}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {profileData && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div className="rounded-3xl border border-gray-700/50 bg-gray-800/50 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Which Fits You Best</h2>
                <p className="text-sm text-gray-400">
                  Choose at least {MIN_PROFILE_FITS}. This is visible on your profile.
                </p>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-200">
                {profileData.profileFits?.length || 0}/{PROFILE_FIT_OPTIONS.length} selected
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(profileData.profileFits || []).length > 0 ? (
                profileData.profileFits?.map((fit) => (
                  <span
                    key={fit}
                    className="rounded-full border border-pink-400/30 bg-pink-500/10 px-3 py-1 text-sm font-medium text-pink-100"
                  >
                    {fit}
                  </span>
                ))
              ) : (
                <p className="text-sm text-slate-400">No selections yet. Add at least three in the Basics tab.</p>
              )}
            </div>
          </div>
        </div>
      )}
      <ProfileTabs activeSection={activeSection} setActiveSection={setActiveSection} />

      <div className="max-w-4xl mx-auto p-4 pb-20">
        {profileData && activeSection === 'photos' && (
          <PhotosSection
            profileData={profileData}
            handlePhotoUpload={handlePhotoUpload}
            removePhoto={removePhoto}
          />
        )}

        {profileData && activeSection === 'basics' && (
          <BasicInfoSection profileData={profileData} setProfileData={setProfileData} />
        )}

        {profileData && activeSection === 'passions' && (
          <PassionsSection profileData={profileData} setProfileData={setProfileData} />
        )}

        {profileData && activeSection === 'faith' && (
          <FaithSection profileData={profileData} setProfileData={setProfileData} />
        )}

        {activeSection === 'subscription' && (
          <ManageSubscriptionSection user={layoutUser} />
        )}
      </div>

      {activeSection !== 'subscription' ? (
        <SaveButton isSaving={isSaving} saveMessage={saveMessage} handleSave={handleSave} />
      ) : null}

      <div className="h-32" />
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 text-white pb-20 no-horizontal-scroll dashboard-main">
      {/* Desktop Layout */}
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
            title="My Profile"
          />
          <div className="flex-1 overflow-y-auto">{content}</div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden min-h-screen">
        <TopBar
          userName={layoutName}
          userImage={layoutImage}
          user={layoutUser}
          showFilters={false}
          showSidePanel={showSidePanel}
          onToggleFilters={() => {}}
          onToggleSidePanel={() => setShowSidePanel(true)}
          title="My Profile"
        />
        <div className="flex-1">{content}</div>
      </div>

      {showSidePanel && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowSidePanel(false)} />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw]">
            <SidePanel
              userName={layoutName}
              userImage={layoutImage}
              user={layoutUser}
              onClose={() => setShowSidePanel(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default function ProtectedProfileWrapper() {
  return (
    <ProtectedRoute>
      <ProfilePage />
    </ProtectedRoute>
  );
}




