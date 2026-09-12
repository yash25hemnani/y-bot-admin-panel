const express = require("express");
const path = require("path");
const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src", "views"));
app.use("/assets", express.static(path.join(__dirname, "public", "assets")));
app.get("/panel", (req, res) => {
  res.render("layout", { title: "Dashboard", bodyPath: "pages/dashboard", currentPath: "/panel", user: { username: "admin", role: "Owner" } });
});
app.get("/panel/login", (req, res) => res.render("login", { error: null }));
app.listen(4501, () => console.log("preview up on 4501"));
