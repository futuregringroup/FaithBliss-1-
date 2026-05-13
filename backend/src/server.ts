import dotenv from "dotenv";
dotenv.config();

import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Request, Response } from "express";
import http from "http";
import mongoose from "mongoose";
import multer from "multer";
import path from "path";
import { Server } from "socket.io";

import authRoutes from "./routes/authRoutes";
import { initializeLocalizedSubscription } from "./controllers/paymentController";
import { getPublicFeatureSettings } from "./controllers/userController";
import discoverRoutes from "./routes/discoverRoutes";
import matchRoutes from "./routes/matchRoutes";
import messageRoutes from "./routes/messageRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import paymentRoutes from "./routes/paymentRoutes";
import photoRoutes from "./routes/photoRoutes";
import storyRoutes from "./routes/storyRoutes";
import supportRoutes from "./routes/supportRoutes";
import uploadRoutes from "./routes/uploadRoutes";
import userRoutes from "./routes/userRoutes";
import { protect } from "./middleware/authMiddleware";
import { backendAvailabilityGate } from "./middleware/backendAvailabilityMiddleware";
import { startStoryCleanupService } from "./services/storyCleanupService";
import { startSubscriptionRenewalService } from "./services/subscriptionRenewalService";
import { initializeSocketIO } from "./socket/socket";

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://faithblissafrica.com",
  "https://www.faithblissafrica.com",
  process.env.CLIENT_URL,
].filter((origin): origin is string => Boolean(origin));

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});
initializeSocketIO(io);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "Pragma",
      "Expires",
    ],
  }),
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
};

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "Server Running",
    database:
      mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    service: "Faithbliss Backend",
  });
});

app.use("/api", backendAvailabilityGate);

app.use("/api/auth", authRoutes);
app.get("/api/users/public-feature-settings", getPublicFeatureSettings);
app.use("/api/users", protect, userRoutes);
app.use("/api/matches", protect, matchRoutes);
app.use("/api/messages", protect, messageRoutes);
app.use("/api/discover", protect, discoverRoutes);
app.use("/api/notifications", protect, notificationRoutes);
app.use("/api/payments", paymentRoutes);
app.post("/api/pay", protect, initializeLocalizedSubscription);
app.use("/api/support", protect, supportRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/users", photoRoutes);
app.use("/api/stories", protect, storyRoutes);

app.use((err: any, _req: Request, res: Response, _next: any) => {
  if (err instanceof multer.MulterError) {
    console.error("Multer Error:", err.message);
    return res.status(400).json({
      message: `File upload error: ${err.message}`,
      code: err.code,
    });
  }

  const statusCode =
    err.statusCode ||
    err.status ||
    (res.statusCode === 200 ? 500 : res.statusCode);
  return res.status(statusCode).json({
    message: err.message || "Internal server error",
    stack: process.env.NODE_ENV === "production" ? "hidden" : err.stack,
  });
});

const startServer = async () => {
  try {
    await connectDB();

    httpServer.listen(PORT, () => {
      startStoryCleanupService();
      startSubscriptionRenewalService();
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

export { app };

if (process.env.VERCEL !== '1') {
  startServer();
}
