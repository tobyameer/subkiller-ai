import { UserModel } from "../models/User.js";

function sanitize(user) {
  if (!user) return user;
  const { passwordHash, ...rest } = user.toObject ? user.toObject() : user;
  return rest;
}

export async function updateMe(req, res, next) {
  try {
    const updates = {};
    const fields = ["firstName", "lastName", "gender", "dob", "country", "marketingOptIn"];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = f === "dob" && req.body[f] ? new Date(req.body[f]) : req.body[f];
    });
    const user = await UserModel.findByIdAndUpdate(req.user.id, { $set: updates }, { new: true });
    res.json({ user: sanitize(user) });
  } catch (err) {
    next(err);
  }
}

