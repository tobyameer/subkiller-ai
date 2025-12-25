export function requirePro(req, res, next) {
  const plan = req.user?.plan || "starter";
  if (plan !== "pro") {
    return res.status(403).json({ code: "PRO_REQUIRED", message: "Upgrade to Pro to connect cards." });
  }
  return next();
}
