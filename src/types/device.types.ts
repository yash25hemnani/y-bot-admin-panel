export type DeviceStatus = "online" | "offline" | "revoked";

// A device as the panel views render it
export interface DeviceView {
  id: string;
  deviceId: string;
  name: string;
  type: string;
  status: DeviceStatus;
  owner: string | null;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface DeviceCounts {
  total: number;
  online: number;
  offline: number;
  revoked: number;
}

// Banner shown after a redirect (?notice=)
export interface DeviceNotice {
  tone: "success" | "warning";
  text: string;
}

// Optional extras for the device detail page
export interface DevicePageExtras {
  newSecret?: string;
  secretReason?: "created" | "rotated";
  deleteError?: string;
}
