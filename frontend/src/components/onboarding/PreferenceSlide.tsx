/* eslint-disable no-irregular-whitespace */
// src/components/onboarding/PreferenceSlide.tsx

import React from "react";
// Ensure all necessary types are imported
import type {
  OnboardingData,
  FaithJourney,
  ChurchAttendance,
  RelationshipGoals,
} from "./types.ts";
import { motion } from "framer-motion";

interface PreferenceSlideProps {
  onboardingData: OnboardingData;
  setOnboardingData: React.Dispatch<React.SetStateAction<OnboardingData>>;
  isVisible: boolean;
}

const faithJourneyOptions = ["Growing", "Rooted", "Exploring", "Passionate"];
const churchInvolvementOptions = [
  "Weekly",
  "Biweekly",
  "Monthly",
  "Occasionally",
  "Rarely",
];
const relationshipGoalsOptions = ["Friendship", "Dating", "Marriage-minded"];
const genderOptions = ["Male", "Female"];
const denominations = [
  "BAPTIST",
  "METHODIST",
  "PRESBYTERIAN",
  "PENTECOSTAL",
  "CATHOLIC",
  "ORTHODOX",
  "ANGLICAN",
  "LUTHERAN",
  "ASSEMBLIES_OF_GOD",
  "SEVENTH_DAY_ADVENTIST",
  "OTHER",
];

const PreferenceSlide: React.FC<PreferenceSlideProps> = ({
  onboardingData,
  setOnboardingData,
  isVisible,
}) => {
  // 🛠️ FINAL FIX: Refined generic handler to explicitly type the list and item, removing 'as any'.
  const handleMultiSelectChange = <T extends string>(
    field:
      | "preferredFaithJourney"
      | "preferredChurchAttendance"
      | "preferredRelationshipGoals",
    value: T, // value is a string literal type (e.g., FaithJourney, ChurchAttendance, etc.)
  ) => {
    setOnboardingData((prev) => {
      // Cast the previous state field to the expected array of strings for list operations
      // We know this is safe because the 'field' argument limits the choice.
      const list = (prev[field] as T[] | null) || ([] as T[]);

      const newList = list.includes(value)
        ? list.filter((item: T) => item !== value)
        : [...list, value];

      return { ...prev, [field]: newList };
    });
  };

  const handleSingleSelectChange = (
    field: "preferredDenomination",
    value: string,
  ) => {
    setOnboardingData((prev) => {
      const current = Array.isArray(prev[field]) ? (prev[field] as string[]) : [];
      const newList = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [field]: newList };
    });
  };

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white">Your Preferences 🎯</h2>
        <p className="text-gray-400">Help us find the right match for you.</p>
      </div>

      {/* Preferred Faith Journey */}
      <div>
        <label className="block text-lg font-medium text-gray-300 mb-3">
          🌱 Preferred Faith Journey
        </label>
        <div className="flex flex-wrap gap-3">
          {faithJourneyOptions.map((option) => {
            // Type assertion for FaithJourney
            const value = option.toUpperCase() as FaithJourney;
            return (
              <button
                key={option}
                type="button"
                onClick={() =>
                  handleMultiSelectChange("preferredFaithJourney", value)
                }
                className={`px-5 py-3 rounded-full text-md font-semibold transition-colors duration-100 active:scale-95 ${
                  (onboardingData.preferredFaithJourney || [])?.includes(value)
                    ? "bg-pink-600 text-white ring-2 ring-pink-400 ring-offset-1 ring-offset-transparent"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      {/* Preferred Church Involvement */}
      <div>
        <label className="block text-lg font-medium text-gray-300 mb-3">
          ⛪ Preferred Church Involvement
        </label>
        <div className="flex flex-wrap gap-3">
          {churchInvolvementOptions.map((option) => {
            // Type assertion for ChurchAttendance
            const value = option.toUpperCase() as ChurchAttendance;
            return (
              <button
                key={option}
                type="button"
                onClick={() =>
                  handleMultiSelectChange("preferredChurchAttendance", value)
                }
                className={`px-5 py-3 rounded-full text-md font-semibold transition-colors duration-100 active:scale-95 ${
                  (onboardingData.preferredChurchAttendance || [])?.includes(
                    value,
                  )
                    ? "bg-pink-600 text-white ring-2 ring-pink-400 ring-offset-1 ring-offset-transparent"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      {/* Preferred Relationship Goals */}
      <div>
        <label className="block text-lg font-medium text-gray-300 mb-3">
          🎯 Preferred Relationship Goals
        </label>
        <div className="flex flex-wrap gap-3">
          {relationshipGoalsOptions.map((option) => {
            // Type assertion for RelationshipGoals
            const value = option
              .replace("-", "_")
              .toUpperCase() as RelationshipGoals;
            return (
              <button
                key={option}
                type="button"
                onClick={() =>
                  handleMultiSelectChange("preferredRelationshipGoals", value)
                }
                className={`px-5 py-3 rounded-full text-md font-semibold transition-colors duration-100 active:scale-95 ${
                  (onboardingData.preferredRelationshipGoals || [])?.includes(
                    value,
                  )
                    ? "bg-pink-600 text-white ring-2 ring-pink-400 ring-offset-1 ring-offset-transparent"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      {/* Preferred Denominations (Multi Select) */}
      <div>
        <label className="block text-lg font-medium text-gray-300 mb-3">
          🕊️ Preferred Denomination
        </label>
        <div className="flex flex-wrap gap-3">
          {denominations.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() =>
                handleSingleSelectChange("preferredDenomination", option)
              }
              className={`px-5 py-3 rounded-full text-md font-semibold transition-colors duration-100 active:scale-95 ${
                Array.isArray(onboardingData.preferredDenomination) &&
                onboardingData.preferredDenomination.includes(option)
                  ? "bg-pink-600 text-white ring-2 ring-pink-400 ring-offset-1 ring-offset-transparent"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {option.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Preferred Gender */}
      <div>
        <label className="block text-lg font-medium text-gray-300 mb-3">
          🧑‍🤝‍🧑 I am interested in
        </label>
        <div className="flex flex-wrap gap-3">
          {genderOptions.map((option) => {
            const value = option.toUpperCase() as "MALE" | "FEMALE";
            return (
              <button
                key={option}
                type="button"
                onClick={() =>
                  setOnboardingData((prev) => ({
                    ...prev,
                    preferredGender:
                      prev.preferredGender === value ? null : value,
                  }))
                }
                className={`px-5 py-3 rounded-full text-md font-semibold transition-colors duration-100 active:scale-95 ${
                  onboardingData.preferredGender === value
                    ? "bg-pink-600 text-white ring-2 ring-pink-400 ring-offset-1 ring-offset-transparent"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      {/* Preferred Age Range */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label
            htmlFor="minAge"
            className="block text-lg font-medium text-gray-300"
          >
            Minimum Age
          </label>
          <input
            type="number"
            id="minAge"
            value={onboardingData.minAge || ""}
            onChange={(e) =>
              setOnboardingData((prev) => ({
                ...prev,
                minAge: parseInt(e.target.value, 10) || null,
              }))
            }
            className="mt-2 block w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg shadow-sm text-white placeholder-gray-400 focus:outline-none focus:ring-pink-500 focus:border-pink-500 sm:text-md"
            placeholder="18"
          />
        </div>
        <div>
          <label
            htmlFor="maxAge"
            className="block text-lg font-medium text-gray-300"
          >
            Maximum Age
          </label>
          <input
            type="number"
            id="maxAge"
            value={onboardingData.maxAge || ""}
            onChange={(e) =>
              setOnboardingData((prev) => ({
                ...prev,
                maxAge: parseInt(e.target.value, 10) || null,
              }))
            }
            className="mt-2 block w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg shadow-sm text-white placeholder-gray-400 focus:outline-none focus:ring-pink-500 focus:border-pink-500 sm:text-md"
            placeholder="99"
          />
        </div>
      </div>

      {/* Preferred Distance */}
      <div>
        <label
          htmlFor="maxDistance"
          className="block text-lg font-medium text-gray-300 mb-3"
        >
          📍 Maximum Distance (in kilometers)
        </label>
        <input
          type="range"
          id="maxDistance"
          min="1"
          max="500"
          value={onboardingData.maxDistance || 50}
          onChange={(e) =>
            setOnboardingData((prev) => ({
              ...prev,
              maxDistance: parseInt(e.target.value, 10) || null,
            }))
          }
          className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer mt-3 accent-pink-500"
        />
        <div className="text-center text-gray-400 mt-2 text-lg">
          {onboardingData.maxDistance || 50} km
        </div>
      </div>
    </motion.div>
  );
};

export default PreferenceSlide;
