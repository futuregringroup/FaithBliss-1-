/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Ban,
  Heart,
  Loader2,
  Lock,
  MessageCircle,
  User,
  UserX,
  MapPin,
  Church,
  Users,
  Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ProtectedRoute from "../components/auth/ProtectedRoute";
import { useAuthContext } from "../contexts/AuthContext";
import { TopBar } from "../components/dashboard/TopBar";
import { SidePanel } from "../components/dashboard/SidePanel";
import { useConversations, useMatches, useMatching } from "../hooks/useAPI";
import { HeartBeatLoader } from "../components/HeartBeatLoader";
import type { Match } from "../types/Match";
import type { ConversationSummary } from "../types/chat";

const MatchesPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"mutual" | "sent" | "received">(
    "mutual"
  );
  const { user } = useAuthContext();
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [actionState, setActionState] = useState<{
    userId: string;
    action: "unmatch" | "unmatch-block";
  } | null>(null);

  const userName = user?.name || "User";
  const userImage = user?.profilePhoto1 || undefined;

  const { mutual, sent, received, loading, error, refetch } = useMatches();
  const { data: conversationsData } = useConversations() as {
    data: ConversationSummary[] | null;
  };
  const { likeUser, unmatchUser, unmatchAndBlockUser } = useMatching();
  const chatLockByUserId = useMemo(() => {
    const conversations = Array.isArray(conversationsData) ? conversationsData : [];
    const map = new Map<string, ConversationSummary>();
    conversations.forEach((conversation) => {
      const otherUserId = conversation.otherUser?.id;
      if (!otherUserId) return;
      map.set(otherUserId, conversation);
    });
    return map;
  }, [conversationsData]);

  const { mutualMatches, sentRequests, receivedRequests } = useMemo(() => {
    const normalize = (data: any): Match[] => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      if ("matches" in data && Array.isArray(data.matches)) return data.matches;
      return [];
    };

    const mutualList = normalize(mutual);
    const mutualIds = new Set(
      mutualList
        .map((m) => m.matchedUserId || m.id)
        .filter(Boolean)
        .map(String)
    );

    const sentList = normalize(sent).filter((m) => {
      const id = m.matchedUserId || m.id;
      return id ? !mutualIds.has(String(id)) : true;
    });

    const receivedList = normalize(received).filter((m) => {
      const id = m.matchedUserId || m.id;
      return id ? !mutualIds.has(String(id)) : true;
    });

    return {
      mutualMatches: mutualList,
      sentRequests: sentList,
      receivedRequests: receivedList,
    };
  }, [mutual, sent, received]);

  /*

  

    console.log("🧠 Processed Matches", {
      mutualCount: mutualList.length,
      sentCount: sentList.length,
      receivedCount: receivedList.length,
    });
  }, [mutual, sent, received]);

  */
  const MatchCard = ({
    match,
    canMessage,
    chatLocked,
    showLikeBack,
    onLikeBack
  }: {
    match: Match;
    canMessage: boolean;
    chatLocked?: boolean;
    showLikeBack: boolean;
    onLikeBack?: (userId: string) => void;
  }) => {
    const user = match.matchedUser || match;
    const profileId = match.matchedUserId || match.id;

    return (
      <motion.div
        layout
        className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 hover:bg-white/15 transition-all duration-300 group"
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="relative">
            <img
              src={user.profilePhoto1 || "/default-avatar.png"}
              alt={user.name || "User"}
              className="w-16 h-16 object-cover rounded-full ring-2 ring-pink-500/30"
            />
            <div
              className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-gray-900 ${
                user.isActive ? "bg-emerald-400" : "bg-gray-500"
              }`}
            />
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white group-hover:text-pink-200 transition-colors">
                {user.name || "Unknown"}, {user.age ?? 0}
              </h3>
            </div>

            <div className="flex items-center gap-2 text-gray-300 text-sm mt-1">
              <MapPin className="w-4 h-4" />
              <span>{user.location || "Not specified"}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-300 text-sm">
              <Church className="w-4 h-4" />
              <span>{user.denomination || "Not specified"}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          {canMessage && !chatLocked ? (
            <Link
              to={`/messages?profileId=${encodeURIComponent(profileId)}&profileName=${encodeURIComponent(user.name || "User")}`}
              className="flex-1"
            >
              <button className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white py-3 rounded-2xl font-medium transition-all duration-300 hover:shadow-lg hover:shadow-pink-500/25 flex items-center justify-center gap-2 group">
                <MessageCircle className="w-4 h-4 group-hover:scale-110 transition-transform duration-300" />
                Message
              </button>
            </Link>
          ) : canMessage ? (
            <button
              type="button"
              onClick={() => navigate("/premium")}
              className="flex-1 w-full bg-amber-500/10 border border-amber-300/25 text-amber-100 py-3 rounded-2xl font-medium flex items-center justify-center gap-2 transition hover:bg-amber-500/15"
              title="Upgrade to unlock another active chat"
            >
              <Lock className="w-4 h-4" />
              Chat Locked
            </button>
          ) : (
            <button
              disabled
              className="flex-1 w-full bg-white/10 border border-white/10 text-gray-500 py-3 rounded-2xl font-medium flex items-center justify-center gap-2 cursor-not-allowed"
              title="Messaging is available after a mutual match"
            >
              <MessageCircle className="w-4 h-4" />
              Message
            </button>
          )}
          {showLikeBack ? (
            <button
              onClick={() => onLikeBack?.(profileId)}
              className="flex-1 w-full bg-emerald-500/90 hover:bg-emerald-500 text-white py-3 rounded-2xl font-medium transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/25 flex items-center justify-center gap-2 group"
            >
              <Heart className="w-4 h-4 group-hover:scale-110 transition-transform duration-300" />
              Like Back
            </button>
          ) : (
            <Link to={`/profile/${profileId}`} className="flex-1">
              <button className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 hover:border-white/30 text-gray-300 hover:text-white py-3 rounded-2xl font-medium transition-all duration-300 flex items-center justify-center gap-2 group">
                <User className="w-4 h-4 group-hover:scale-110 transition-transform duration-300" />
                View Profile
              </button>
            </Link>
          )}
        </div>

        {canMessage && chatLocked ? (
          <p className="mt-3 text-xs text-amber-100/85">
            Free plan allows one active chat at a time. Upgrade to premium or unmatch your current chat to unlock this one.
          </p>
        ) : null}

        {canMessage && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={actionState?.userId === profileId}
              onClick={async () => {
                if (!window.confirm(`Unmatch ${user.name || "this user"}? This will remove the match and chat access.`)) {
                  return;
                }
                try {
                  setActionState({ userId: profileId, action: "unmatch" });
                  await unmatchUser(profileId);
                  await refetch();
                } finally {
                  setActionState((current) => (current?.userId === profileId ? null : current));
                }
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 font-medium text-amber-100 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionState?.userId === profileId && actionState.action === "unmatch" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserX className="h-4 w-4" />
              )}
              Unmatch
            </button>

            <button
              type="button"
              disabled={actionState?.userId === profileId}
              onClick={async () => {
                if (
                  !window.confirm(
                    `Unmatch and block ${user.name || "this user"}? They will no longer appear in your feed or matches.`
                  )
                ) {
                  return;
                }
                try {
                  setActionState({ userId: profileId, action: "unmatch-block" });
                  await unmatchAndBlockUser(profileId);
                  await refetch();
                } finally {
                  setActionState((current) => (current?.userId === profileId ? null : current));
                }
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 font-medium text-rose-100 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionState?.userId === profileId && actionState.action === "unmatch-block" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Ban className="h-4 w-4" />
              )}
              Unmatch &amp; Block
            </button>
          </div>
        )}
      </motion.div>
    );
  };

  if (loading) return <HeartBeatLoader message="Loading your matches..." />;

  if (error) {
    const errorContent = (
      <div className="pt-5 sm:pt-6 lg:pt-8 pb-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 flex items-center justify-start">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15"
              aria-label="Back to dashboard"
              title="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
          <div className="text-center p-8">
            <p className="text-red-400 mb-4">Failed to load matches: {String(error)}</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 text-white dashboard-main">
        {/* Desktop Layout */}
        <div className="hidden lg:flex min-h-screen">
          <div className="w-80 flex-shrink-0">
            <SidePanel userName={userName} userImage={userImage} user={user} onClose={() => setShowSidePanel(false)} />
          </div>
          <div className="flex-1 flex flex-col min-h-screen">
            <TopBar
              userName={userName}
              userImage={userImage}
              user={user}
              showFilters={false}
              showSidePanel={showSidePanel}
              onToggleFilters={() => {}}
              onToggleSidePanel={() => setShowSidePanel(false)}
              title="Matches"
            />
            <div className="flex-1 overflow-y-auto">{errorContent}</div>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden min-h-screen">
          <TopBar
            userName={userName}
            userImage={userImage}
            user={user}
            showFilters={false}
            showSidePanel={showSidePanel}
            onToggleFilters={() => {}}
            onToggleSidePanel={() => setShowSidePanel(true)}
            title="Matches"
          />
          <div className="flex-1">{errorContent}</div>
        </div>

        {showSidePanel && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setShowSidePanel(false)}
            />
            <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw]">
              <SidePanel
                userName={userName}
                userImage={userImage}
                user={user}
                onClose={() => setShowSidePanel(false)}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  const renderEmpty = (Icon: any, title: string, subtitle: string) => (
    <div className="text-center py-16">
      <div className="bg-gradient-to-r from-pink-500/20 to-purple-600/20 backdrop-blur-xl border border-pink-500/30 rounded-3xl p-8 max-w-md mx-auto">
        <Icon className="w-16 h-16 text-pink-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
        <p className="text-gray-400">{subtitle}</p>
      </div>
    </div>
  );

  const activeList =
    activeTab === "mutual"
      ? mutualMatches
      : activeTab === "sent"
      ? sentRequests
      : receivedRequests;

  const content = (
    <div className="pt-5 sm:pt-6 lg:pt-8 pb-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-start">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15"
            aria-label="Back to dashboard"
            title="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
            Your Matches
          </h1>
          <p className="text-gray-400 text-lg">
            Connections made in faith and love
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-2 mb-8">
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "mutual", label: "Mutual", count: mutualMatches.length, icon: Heart },
              { key: "sent", label: "Sent", count: sentRequests.length, icon: Clock },
              { key: "received", label: "Received", count: receivedRequests.length, icon: Users },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`relative py-3 sm:py-4 px-3 sm:px-6 rounded-2xl transition-all duration-300 ${
                  activeTab === tab.key
                    ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/25"
                    : "text-gray-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <tab.icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-bold ${
                      activeTab === tab.key
                        ? "bg-white/20 text-white"
                        : "bg-white/10 text-gray-400"
                    }`}
                  >
                    {tab.count}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {activeList.length > 0
              ? activeList.map((match: Match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    canMessage={activeTab === "mutual"}
                    chatLocked={Boolean(chatLockByUserId.get(String(match.matchedUserId || match.id))?.chatLocked)}
                    showLikeBack={activeTab === "received"}
                    onLikeBack={async (userId: string) => {
                      await likeUser(userId);
                      await refetch();
                    }}
                  />
                ))
              : activeTab === "mutual"
              ? renderEmpty(
                  Heart,
                  "No mutual matches yet",
                  "Keep exploring to find your perfect match!"
                )
              : activeTab === "sent"
              ? renderEmpty(
                  Clock,
                  "No sent requests yet",
                  "You haven't sent any requests yet."
                )
              : renderEmpty(
                  Users,
                  "No received requests yet",
                  "No one has sent you a request yet."
                )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 text-white dashboard-main">
      {/* Desktop Layout */}
      <div className="hidden lg:flex min-h-screen">
        <div className="w-80 flex-shrink-0">
          <SidePanel userName={userName} userImage={userImage} user={user} onClose={() => setShowSidePanel(false)} />
        </div>
        <div className="flex-1 flex flex-col min-h-screen">
          <TopBar
            userName={userName}
            userImage={userImage}
            user={user}
            showFilters={false}
            showSidePanel={showSidePanel}
            onToggleFilters={() => {}}
            onToggleSidePanel={() => setShowSidePanel(false)}
            title="Matches"
          />
          <div className="flex-1 overflow-y-auto">{content}</div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden min-h-screen">
        <TopBar
          userName={userName}
          userImage={userImage}
          user={user}
          showFilters={false}
          showSidePanel={showSidePanel}
          onToggleFilters={() => {}}
          onToggleSidePanel={() => setShowSidePanel(true)}
          title="Matches"
        />
        <div className="flex-1">{content}</div>
      </div>

      {showSidePanel && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowSidePanel(false)}
          />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw]">
            <SidePanel
              userName={userName}
              userImage={userImage}
              user={user}
              onClose={() => setShowSidePanel(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default function ProtectedMatches() {
  return (
    <ProtectedRoute>
      <MatchesPage />
    </ProtectedRoute>
  );
}
