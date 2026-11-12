import { JwtPayload } from "jsonwebtoken";

// Claims inside an access token (see generateAccessToken in utils/tokens.ts)
export interface TokenPayload extends JwtPayload {
  userId: string;
  role: string;
}
