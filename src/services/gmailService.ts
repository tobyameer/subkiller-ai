import { google } from "googleapis";
import { Types } from "mongoose";
import { getGoogleClient } from "../config/google";
import { UserModel } from "../models/User";
import { extractSubscription } from "./aiService";
import { normalizeAmount, normalizeTextField } from "../utils/normalize";
import { IgnoredSenderModel } from "../models/IgnoredSender";
import { type BillingCycle, computeNextRenewal } from "../utils/billingDates";
import { ChargeModel } from "../models/Charge";
import { SubscriptionModel } from "../models/Subscription";
import { autoMarkInactiveSubscriptions } from "./subscriptionService";

const PROMO_SUBJECT_PATTERN = /(percent off|% off|off for life|discount|offer|sale|gift guide|deal|promo|holiday|special offer|save)/i;
const RECEIPT_SUBJECT_PATTERN = /(receipt|invoice|charged|payment|billed|renewal|renews|subscription|membership|your plan|premium|order total|amount charged|your order|you have been charged)/i;

function applySubscriptionHeuristics(input: {
  from: string;
  subject: string;
  snippetOrBody: string;
  kind: string;
  billingCycle: BillingCycle;
  service?: string | null;
}): { kind: string; billingCycle: BillingCycle; service: string | null } {
  const fromLc = (input.from || "").toLowerCase();
  const subjectLc = (input.subject || "").toLowerCase();
  const bodyLc = (input.snippetOrBody || "").toLowerCase();

  let { kind, billingCycle, service } = input;

  const spotifyMatch =
    fromLc.includes("spotify.com") ||
    subjectLc.includes("spotify") ||
    bodyLc.includes("spotify") ||
    bodyLc.includes("premium for students");

  if (spotifyMatch) {
    const recurringPhrases = [
      "each month until you cancel",
      "per month until you cancel",
      "you will be charged",
      "charge you $",
      "premium for students",
      "premium",
      "subscription",
    ];
    const isRecurring = recurringPhrases.some((p) => bodyLc.includes(p) || subjectLc.includes(p));
    if (isRecurring) {
      kind = "subscription";
      billingCycle = "monthly";
      if (!service || service.toLowerCase() === "unknown") service = "Spotify";
    }
  }

  return { kind, billingCycle, service: service ?? null };
}

function applyBillingHeuristics(input: {
  from: string;
  subject: string;
  body: string;
  amount: number | null;
  kind: string;
  billingCycle: BillingCycle;
  service?: string | null;
  attachments?: { filename?: string | null }[];
  statusEventType?: string | null;
  chargeDate?: string | null;
}) {
  const promoKeywords = [
    "sale",
    "50% off",
    "25% off",
    "% off",
    "discount",
    "offer",
    "promo",
    "promotion",
    "gift guide",
    "black friday",
    "cyber monday",
    "this weekend only",
    "today only",
    "use code",
    "coupon",
    "deal",
    "shop now",
    "save",
  ];
  const receiptKeywords = [
    "receipt",
    "e-receipt",
    "invoice",
    "subscription fee invoice",
    "order confirmation",
    "order placed",
    "thanks for your order",
    "payment receipt",
  ];
  const failureKeywords = ["payment failed", "unable to charge", "could not be renewed", "on hold", "billing issue"];
  const trialKeywords = ["trial", "start your trial", "trial offer"];

  const text = `${input.subject || ""} ${input.body || ""}`.toLowerCase();
  const hasPromo = promoKeywords.some((k) => text.includes(k));
  const hasReceipt = receiptKeywords.some((k) => text.includes(k));
  const hasFailure = failureKeywords.some((k) => text.includes(k));
  const hasTrial = trialKeywords.some((k) => text.includes(k));
  const hasReceiptAttachment =
    input.attachments?.some((a) => {
      const name = (a.filename || "").toLowerCase();
      return name.includes("invoice") || name.includes("receipt") || name.includes("subscription-charge");
    }) ?? false;

  let kind = input.kind;
  let statusEventType = input.statusEventType;
  let billingCycle = input.billingCycle;
  let service = input.service ?? null;
  let amount = input.amount;

  // Amount/Kind hard gates for billing events
  if (kind === "billing_event" && (amount === null || !Number.isFinite(amount) || amount <= 0)) {
    kind = "marketing";
    amount = 0;
  }

  // Promo dominance without receipt language -> marketing
  if (hasPromo && !hasReceipt && !hasReceiptAttachment) {
    kind = "marketing";
    amount = 0;
  }

  // Payment failures/on hold/trials => status_event
  if (text.includes("on hold")) {
    kind = "status_event";
    statusEventType = "on_hold";
    amount = 0;
  } else if (hasFailure) {
    kind = "status_event";
    statusEventType = "payment_failed";
    amount = 0;
  } else if (hasTrial) {
    kind = "status_event";
    statusEventType = "trial_offer";
    amount = 0;
  }

  // Provider overrides
  const fromLc = (input.from || "").toLowerCase();
  const bodyLc = (input.body || "").toLowerCase();
  if (fromLc.includes("spotify.com")) {
    const recurring =
      bodyLc.includes("each month until you cancel") ||
      bodyLc.includes("per month until you cancel") ||
      bodyLc.includes("charge you") ||
      bodyLc.includes("order confirmation");
    if (recurring && kind !== "marketing" && amount && amount > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[gmail] Forced subscription classification for provider=Spotify subject=${input.subject || "N/A"} kind=billing_event billingCycle=monthly`,
      );
      kind = "billing_event";
      billingCycle = "monthly";
      service = service || "Spotify";
    }
  }
  if (fromLc.includes("talabat.com")) {
    const talabatRecurring = bodyLc.includes("subscription fee invoice") || bodyLc.includes("subscription e-receipt");
    if (talabatRecurring && kind !== "marketing") {
      // eslint-disable-next-line no-console
      console.log(
        `[gmail] Forced subscription classification for provider=Talabat subject=${input.subject || "N/A"} kind=billing_event billingCycle=${billingCycle !== "unknown" ? billingCycle : "monthly"}`,
      );
      kind = kind === "status_event" ? kind : "billing_event";
      billingCycle = billingCycle !== "unknown" ? billingCycle : "monthly";
      service = service || "Talabat Pro";
    }
  }

  // Receipt/invoice evidence keeps billing classification unless explicitly marketing
  if (kind === "billing_event" && !hasReceipt && !hasReceiptAttachment && hasPromo) {
    kind = "marketing";
    amount = 0;
  }

  return { ...input, kind, amount, billingCycle, service, statusEventType };
}

export async function exchangeCodeForTokens(code: string, userId: string) {
  const client = getGoogleClient();
  const { tokens } = await client.getToken(code);
  await UserModel.findByIdAndUpdate(userId, {
    gmailTokens: {
      access: tokens.access_token,
      refresh: tokens.refresh_token,
      expiry: tokens.expiry_date,
    },
  });
  return tokens;
}

export async function getAuthorizedGmailClient(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user || !user.gmailTokens) throw { status: 400, message: "Gmail not connected" };

  const client = getGoogleClient();
  client.setCredentials({
    access_token: user.gmailTokens.access,
    refresh_token: user.gmailTokens.refresh,
    expiry_date: user.gmailTokens.expiry,
  });
  return google.gmail({ version: "v1", auth: client });
}

export async function scanGmailAndStore(userId: string, mode: "incremental" | "full" = "incremental") {
  const user = await UserModel.findById(userId);
  if (!user || !user.gmailTokens) throw { status: 400, message: "Gmail not connected" };

  const gmail = await getAuthorizedGmailClient(userId);
  const now = new Date();
  const safetyMs = 2 * 24 * 60 * 60 * 1000;
  const defaultWindowMs = 365 * 24 * 60 * 60 * 1000;
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;
  const oneYearAgo = new Date(now.getTime() - oneYearMs);
  const afterDate =
    mode === "full"
      ? oneYearAgo
      : user.lastScanDate
        ? new Date(Math.max(oneYearAgo.getTime(), new Date(user.lastScanDate).getTime() - safetyMs))
        : new Date(Math.max(oneYearAgo.getTime(), now.getTime() - defaultWindowMs));
  const formatDate = (d: Date) =>
    `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`;

  const searchQuery = `newer_than:365d (receipt OR invoice OR "thanks for your order" OR "your order" OR payment OR "subscription fee" OR "subscription charge") after:${formatDate(afterDate)}`;

  const maxMessages = 500;
  const concurrency = 4;
  const messageIds: string[] = [];
  let pageToken: string | undefined;
  let pages = 0;

  // eslint-disable-next-line no-console
  console.log("[gmail] Listing messages with query:", searchQuery, "after", afterDate.toISOString());
  do {
    const messages = await gmail.users.messages.list({
      userId: "me",
      maxResults: 200,
      q: searchQuery,
      pageToken,
    });
    pageToken = messages.data.nextPageToken || undefined;
    pages += 1;
    for (const msg of messages.data.messages ?? []) {
      if (messageIds.length >= maxMessages) break;
      if (msg.id) messageIds.push(msg.id);
    }
    if (messageIds.length >= maxMessages) break;
  } while (pageToken && messageIds.length < maxMessages);

  let processed = 0;
  let newCharges = 0;
  let skippedExisting = 0;
  let skippedOther = 0;
  if (mode === "full") {
    await ChargeModel.deleteMany({ user: userId });
    await SubscriptionModel.deleteMany({ userId });
  }

  const queue = [...messageIds];
  const workers = Array.from({ length: concurrency }, () =>
    (async () => {
      while (queue.length > 0) {
        const msgId = queue.shift();
        if (!msgId) break;
        const existingCharge = await ChargeModel.findOne({ user: userId, sourceMessageId: msgId });
        if (existingCharge) {
          skippedExisting += 1;
          // eslint-disable-next-line no-console
          console.log(`[gmail] Skipping already processed message: messageId=${msgId}`);
          continue;
        }

        const message = await gmail.users.messages.get({ userId: "me", id: msgId });
        const headers = message.data.payload?.headers || [];
        const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value ?? undefined;
        const from = headers.find((h) => h.name?.toLowerCase() === "from")?.value ?? undefined;
        const dateHeader = headers.find((h) => h.name?.toLowerCase() === "date")?.value ?? undefined;
        const isSpotify = (from || "").toLowerCase().includes("spotify.com");
        if (isSpotify) {
          // eslint-disable-next-line no-console
          console.log(
            `[gmail] Found Spotify email: subject=${subject || "N/A"} date=${dateHeader || "N/A"} messageId=${msgId}`,
          );
        }
        if (from) {
          const ignored = await IgnoredSenderModel.findOne({ user: userId, sender: from });
          if (ignored) {
            // eslint-disable-next-line no-console
            console.log("[gmail] Skipping ignored sender", from);
            continue;
          }
        }
        const bodyPart = message.data.payload?.parts?.find((p) => p.mimeType === "text/plain");
        const text =
          bodyPart?.body?.data ? Buffer.from(bodyPart.body.data, "base64").toString() : "Subscription email";
        const attachments = message.data.payload?.parts?.filter((p) => p.filename) || [];
        const extracted = await extractSubscription({
          text,
          subject,
          from,
          snippet: message.data.snippet || "",
        });
        if (extracted) {
          // Log early to show what AI returned before gating
          // eslint-disable-next-line no-console
          console.log("[ai] extracted", {
            subject,
            from,
            amount: extracted.amount,
            kind: extracted.kind,
            statusEventType: extracted.statusEventType,
          });
          if (isSpotify) {
            // eslint-disable-next-line no-console
            console.log("[ai] Spotify extraction result", {
              service: extracted.service,
              amount: extracted.amount,
              billingCycle: extracted.billingCycle,
              kind: extracted.kind,
              category: extracted.category,
            });
          }

          const normalizedAmount = normalizeAmount((extracted as any).amount);
          let normalizedService = normalizeTextField((extracted as any).service);
          const normalizedCategory = normalizeTextField((extracted as any).category) || "Other";
          const allowedBilling: BillingCycle[] = ["monthly", "yearly", "weekly", "one_time", "unknown"];
          let normalizedBillingCycle =
            typeof extracted.billingCycle === "string"
              ? ((extracted.billingCycle.toLowerCase() as BillingCycle) || "unknown")
              : "unknown";
          if (!allowedBilling.includes(normalizedBillingCycle)) normalizedBillingCycle = "unknown";

          const heuristicResult = applySubscriptionHeuristics({
            from: from || "",
            subject: subject || "",
            snippetOrBody: text || message.data.snippet || "",
            kind: extracted.kind || "other",
            billingCycle: normalizedBillingCycle,
            service: normalizedService,
          });
          let normalizedKind = heuristicResult.kind;
          normalizedBillingCycle = heuristicResult.billingCycle;
          if (!normalizedService) normalizedService = heuristicResult.service || null;

          const billingHeuristics = applyBillingHeuristics({
            from: from || "",
            subject: subject || "",
            body: text || message.data.snippet || "",
            amount: normalizedAmount,
            kind: normalizedKind,
            billingCycle: normalizedBillingCycle,
            service: normalizedService || undefined,
            attachments,
            statusEventType: extracted.statusEventType || null,
            chargeDate: extracted.chargeDate || null,
          });

          normalizedKind = billingHeuristics.kind;
          normalizedBillingCycle = billingHeuristics.billingCycle;
          normalizedService = billingHeuristics.service ? normalizeTextField(billingHeuristics.service) : normalizedService;
          const statusEventType = billingHeuristics.statusEventType || extracted.statusEventType || null;
          const finalAmount = billingHeuristics.amount ?? normalizedAmount;
          const normalizedCurrency = extracted.currency || "USD";

          if (normalizedKind === "marketing" || normalizedKind === "newsletter" || normalizedKind === "other") {
            // eslint-disable-next-line no-console
            console.log(`[gmail] Skipping non-billing email: subject=${subject || "N/A"} kind=${normalizedKind}`);
            skippedOther += 1;
            continue;
          }

          if (normalizedKind === "status_event") {
            if (!normalizedService) {
              skippedOther += 1;
              continue;
            }
            const sub = await SubscriptionModel.findOne({ userId, service: normalizedService });
            if (!sub) {
              // eslint-disable-next-line no-console
              console.log(
                `[gmail] Status event with no existing subscription (skipping): subject=${subject || "N/A"} type=${statusEventType || "unknown"}`,
              );
              skippedOther += 1;
              continue;
            }
            switch (statusEventType) {
              case "payment_failed":
                sub.status = "past_due";
                break;
              case "on_hold":
                sub.status = "on_hold";
                break;
              case "canceled":
                sub.status = "canceled";
                break;
              case "trial_started":
              case "trial_offer":
                if (sub.status !== "active") sub.status = "trial";
                break;
              case "reactivated":
                sub.status = "active";
                break;
              default:
                break;
            }
            await sub.save();
            skippedOther += 1;
            continue;
          }

          if (normalizedKind === "billing_event") {
            const chargeDateCandidate =
              billingHeuristics.chargeDate && !Number.isNaN(new Date(billingHeuristics.chargeDate).getTime())
                ? new Date(billingHeuristics.chargeDate)
                : message.data.internalDate && !Number.isNaN(Number(message.data.internalDate))
                  ? new Date(Number(message.data.internalDate))
                  : dateHeader && !Number.isNaN(new Date(dateHeader).getTime())
                    ? new Date(dateHeader)
                    : null;

            if (!finalAmount || finalAmount <= 0 || !chargeDateCandidate) {
              // eslint-disable-next-line no-console
              console.log(
                "[gmail] Skipping billing_event with invalid amount/date",
                { subject, amount: finalAmount, chargeDate: chargeDateCandidate },
              );
              skippedOther += 1;
              continue;
            }
            if (!normalizedService) {
              // eslint-disable-next-line no-console
              console.log(`[gmail] Skipping billing_event due to missing service: subject=${subject || "N/A"}`);
              skippedOther += 1;
              continue;
            }

            const chargedAt = chargeDateCandidate;
            const estimatedMonthly =
              normalizedBillingCycle === "monthly"
                ? finalAmount
                : normalizedBillingCycle === "yearly"
                  ? finalAmount / 12
                  : normalizedBillingCycle === "weekly"
                    ? finalAmount * 4
                    : 0;

            if (
              estimatedMonthly <= 0 ||
              !normalizedBillingCycle ||
              normalizedBillingCycle === "one_time" ||
              normalizedBillingCycle === "unknown"
            ) {
              await ChargeModel.create({
                user: new Types.ObjectId(userId),
                service: normalizedService,
                amount: finalAmount,
                currency: normalizedCurrency,
                billingCycle: normalizedBillingCycle,
                chargedAt,
                category: normalizedCategory,
                sourceMessageId: msgId,
                provider: normalizedService,
              });
              skippedOther += 1;
              // eslint-disable-next-line no-console
              console.log("[billing] Recorded one-time charge without subscription", {
                userId,
                service: normalizedService,
                amount: finalAmount,
                billingCycle: normalizedBillingCycle,
              });
              continue;
            }

            let subscription = await SubscriptionModel.findOne({
              userId,
              service: normalizedService,
              deletedAt: null,
            });
            if (!subscription) {
              subscription = await SubscriptionModel.create({
                userId,
                service: normalizedService,
                category: normalizedCategory,
                currency: normalizedCurrency,
                billingCycle: normalizedBillingCycle,
                status: "active",
                monthlyAmount: normalizedBillingCycle === "monthly" ? finalAmount : 0,
                estimatedMonthlySpend: estimatedMonthly,
                firstChargeAt: chargedAt,
                lastChargeAt: chargedAt,
                nextRenewal: computeNextRenewal(chargedAt, normalizedBillingCycle),
                totalCharges: 1,
                totalAmount: finalAmount,
              });
            }

            await ChargeModel.create({
              user: new Types.ObjectId(userId),
              subscription: subscription._id,
              service: normalizedService,
              amount: finalAmount ?? 0,
              currency: normalizedCurrency,
              billingCycle: normalizedBillingCycle,
              kind: "subscription",
              chargedAt,
              sourceMessageId: msgId,
              category: normalizedCategory,
              provider: normalizedService,
            });

            if (!subscription.firstChargeAt || chargedAt < subscription.firstChargeAt) {
              subscription.firstChargeAt = chargedAt;
            }
            if (!subscription.lastChargeAt || chargedAt > subscription.lastChargeAt) {
              subscription.lastChargeAt = chargedAt;
            }
            subscription.totalCharges = (subscription.totalCharges || 0) + 1;
            subscription.totalAmount = (subscription.totalAmount || 0) + finalAmount;
            if (normalizedBillingCycle === "monthly") {
              subscription.monthlyAmount = finalAmount;
              subscription.estimatedMonthlySpend = estimatedMonthly;
            } else if (normalizedBillingCycle === "yearly") {
              subscription.monthlyAmount = finalAmount;
              subscription.estimatedMonthlySpend = estimatedMonthly;
            } else if (normalizedBillingCycle === "weekly") {
              subscription.estimatedMonthlySpend = estimatedMonthly;
            }
            if (
              subscription.status === "canceled" ||
              subscription.status === "expired" ||
              subscription.status === "unknown"
            ) {
              subscription.status = "active";
            }
            subscription.autoCanceled = false;
            subscription.billingCycle = normalizedBillingCycle || subscription.billingCycle;
            subscription.category = subscription.category || normalizedCategory;
            subscription.nextRenewal = computeNextRenewal(chargedAt, normalizedBillingCycle);
            await subscription.save();
            // eslint-disable-next-line no-console
            console.log("[billing] New charge + subscription update", {
              userId,
              service: normalizedService,
              amount: finalAmount,
              billingCycle: normalizedBillingCycle,
              totalCharges: subscription.totalCharges,
              totalAmount: subscription.totalAmount,
            });
            newCharges += 1;
          }
        }
        processed += 1;
      }
    })(),
  );

  await Promise.all(workers);
  user.lastScanDate = new Date();
  await user.save();

  // eslint-disable-next-line no-console
  console.log(
    `[gmail] Scan complete: processed ${processed} messages (limit ${maxMessages}), newCharges=${newCharges}, skippedExisting=${skippedExisting}, skippedOther=${skippedOther}`,
  );

  await autoMarkInactiveSubscriptions(userId);

  return { processed, newCharges, skippedExisting, skippedOther, scannedWindowAfter: afterDate };
}
