export type NavKey = "overview" | "devices" | "activity";

// The signed-in user as layout.ejs sees it (res.locals.user)
export interface PanelUser {
  id: string;
  username: string;
  email: string;
  role: string;
}

export interface Pager {
  page: number;
  totalPages: number;
  total: number;
}
