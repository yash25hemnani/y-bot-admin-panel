import { z } from "zod";

// Schemas for the server-rendered panel (/panel). Pages re-render forms with the
// user's input, so most forms have two schemas: a lenient "values" schema that never
// fails (used to refill the form) and a strict one that decides if the input is valid.
// Query strings use .catch() so a bad value falls back to the default instead of erroring.

const page = z.coerce.number().int().min(1).catch(1);
const notice = z.string().optional().catch(undefined);
const text = (fallback = "") => z.string().catch(fallback);

export const panelLoginValuesSchema = z.object({
  email: z.string().trim().catch(""),
});

export const panelLoginSchema = z.object({
  email: z.string().trim().pipe(z.email()),
  password: z.string().min(1),
});

export const DEVICE_BOARDS = ["ESP32", "ARDUINO"] as const;
export const DEVICE_STATUS_FILTERS = ["all", "online", "offline", "revoked"] as const;
export type DeviceStatusFilter = (typeof DEVICE_STATUS_FILTERS)[number];

export const deviceParamsSchema = z.object({
  id: z.guid(),
});

export const deviceListQuerySchema = z.object({
  status: z.enum(DEVICE_STATUS_FILTERS).catch("all"),
  q: z
    .string()
    .trim()
    .transform((s) => s.slice(0, 64))
    .catch(""),
  page,
  notice,
});

export const deviceNoticeQuerySchema = z.object({ notice });

export const registerDeviceValuesSchema = z.object({
  deviceName: text(),
  deviceType: text("ESP32"),
});

export const registerDeviceSchema = z.object({
  deviceName: z
    .string()
    .trim()
    .min(1, "Give the device a name.")
    .max(64, "Keep the name to 64 characters or fewer."),
  deviceType: z.enum(DEVICE_BOARDS, { error: "Choose the board this device uses." }),
  devicePassword: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(128, "Keep the password to 128 characters or fewer."),
});

export type RegisterDeviceFieldErrors = Partial<Record<keyof z.infer<typeof registerDeviceSchema>, string>>;

// Revoke / enable forms may send a returnTo path; safeReturnTo() still checks it is a panel path
export const returnToBodySchema = z.object({
  returnTo: z.string().optional().catch(undefined),
});

export const deleteDeviceBodySchema = z.object({
  devicePassword: text(),
});

export const ACTIVITY_TYPES = ["all", "auth", "device", "user"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const activityQuerySchema = z.object({
  type: z.enum(ACTIVITY_TYPES).catch("all"),
  page,
});

export const overviewQuerySchema = z.object({ notice });
