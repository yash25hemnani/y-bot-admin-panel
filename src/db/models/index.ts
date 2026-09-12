import { Device } from "./Device";
import { RefreshToken } from "./RefreshToken";
import { User } from "./User";

// User Relations
User.hasMany(RefreshToken, { foreignKey: "userId", as: "tokens" });
RefreshToken.belongsTo(User, { foreignKey: "userId", as: "user" });

// Device Relations
User.hasMany(Device, { foreignKey: "userId", as: "devices" });
Device.belongsTo(User, { foreignKey: "userId", as: "user" });

// Exports
export { User } from "./User";
export { RefreshToken } from "./RefreshToken";
export { UploadedFile } from "./UploadedFile";
export { Device } from "./Device";
