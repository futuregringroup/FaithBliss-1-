// src/routes/matchRoutes.ts (CLEANED)
import express from "express";
import { protect } from "../middleware/authMiddleware";
import {
  getPotentialMatches,
  likeUser,
  passUser,
  unmatchUser,
  unmatchAndBlockUser,
  getMutualMatches,
  getSentMatches,
  getPassedProfiles,
  getReceivedMatches,
} from "../controllers/matchController"; // Only match controllers remain

const router = express.Router();

// Apply protection to all match routes
router.use(protect);

// ----------------------------------------
// ✅ Matching Routes (Protected)
// ----------------------------------------
router.get("/potential", getPotentialMatches); // GET /api/matches/potential
router.post("/like/:userId", likeUser); // POST /api/matches/like/:userId
router.post("/pass/:userId", passUser); // POST /api/matches/pass/:userId
router.post("/unmatch/:userId", unmatchUser);
router.post("/unmatch-block/:userId", unmatchAndBlockUser);
router.get("/mutual", getMutualMatches);
router.get("/sent", getSentMatches);
router.get("/passed", getPassedProfiles);
router.get("/received", getReceivedMatches);

// 🛑 REMOVED all messaging routes (moved to messageRoutes.ts)

export default router;
