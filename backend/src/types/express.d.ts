declare global {
  namespace Express {
    interface Request {
      user?: import('../models/User').IUser & {
        _id: string;
      };
      isAuthenticated(): boolean;
      rawBody?: Buffer;
      userId?: string;
    }
  }
}

export {};
