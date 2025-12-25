import { CountryCode, Products } from "plaid";
import { plaidClient, plaidAvailable } from "../config/plaid.js";
import { UserModel } from "../models/User.js";
import { syncPlaidAndMerge } from "../services/plaidService.js";

const notConfigured = (res) => res.status(501).json({ message: "Plaid not configured" });

export async function createLinkToken(req, res, next) {
  try {
    if (!plaidAvailable) return notConfigured(res);
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: req.user.id },
      client_name: "SubKiller",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    res.json({ link_token: response.data.link_token });
  } catch (err) {
    next(err);
  }
}

export async function exchangePublicToken(req, res, next) {
  try {
    if (!plaidAvailable) return notConfigured(res);
    const { public_token } = req.body;
    if (!public_token) {
      return res.status(400).json({ message: "Missing public_token" });
    }
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;
    await UserModel.findByIdAndUpdate(req.user.id, {
      plaidAccessToken: accessToken,
      plaidItemId: itemId,
      plaidLinked: true,
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function syncPlaid(req, res, next) {
  try {
    if (!plaidAvailable) return notConfigured(res);
    const user = await UserModel.findById(req.user.id);
    if (!user || !user.plaidAccessToken) {
      return res.status(400).json({ message: "Plaid not linked" });
    }

    let cursor = user.plaidCursor || null;
    let hasMore = true;
    const added = [];
    const modified = [];

    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: user.plaidAccessToken,
        cursor,
        count: 100,
      });
      const data = response.data;
      if (data.added?.length) added.push(...data.added);
      if (data.modified?.length) modified.push(...data.modified);
      cursor = data.next_cursor;
      hasMore = data.has_more;
    }

    await UserModel.findByIdAndUpdate(req.user.id, {
      plaidCursor: cursor,
      plaidLinked: true,
    });

    const transactions = [...added, ...modified];
    const summary = await syncPlaidAndMerge(req.user.id, transactions);
    res.json(summary);
  } catch (err) {
    next(err);
  }
}
