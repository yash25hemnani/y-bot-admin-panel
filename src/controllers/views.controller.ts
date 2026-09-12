import { Request, Response } from "express";

export const renderLogin = (req: Request, res: Response) => {
  res.render("login");
};

export const renderDashboard = (req: Request, res: Response) => {
  res.render("layout", {
    title: "Dashboard",
    bodyPath: "pages/dashboard",
    currentPath: "/panel",
    user: null,
  });
};
