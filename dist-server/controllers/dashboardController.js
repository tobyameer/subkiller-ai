import { ChargeModel } from "../models/Charge.js";
import { SubscriptionModel } from "../models/Subscription.js";

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function getLast6MonthsWindow() {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      key,
      label: monthLabels[d.getMonth()],
      start: d,
      end: new Date(d.getFullYear(), d.getMonth() + 1, 1),
    });
  }
  return months;
}

export async function getRecentCharges(req, res, next) {
  try {
    const userId = req.user.id;
    const limit = Number(req.query.limit) || 6;
    const charges = await ChargeModel.find({ userId, status: "paid" })
      .sort({ chargedAt: -1 })
      .limit(limit)
      .lean();
    res.json({
      items: charges.map((c) => ({
        id: c._id,
        service: c.service,
        amount: c.amount,
        currency: c.currency || "USD",
        chargedAt: c.chargedAt,
        subscriptionId: c.subscriptionId,
        status: c.status,
        subject: c.subject,
      })),
    });
  } catch (err) {
    next(err);
  }
}
function computeMonthlyAmountFromCycle(cycle, amount) {
  const amt = Number(amount) || 0;
  switch (cycle) {
    case "yearly":
      return amt / 12;
    case "weekly":
      return amt * 4.345;
    case "monthly":
      return amt;
    default:
      return 0;
  }
}

export async function getDashboardSummary(req, res, next) {
  try {
    const userId = req.user.id;
    const months = getLast6MonthsWindow();
    const windowStart = months[0].start;
    const windowEnd = months[months.length - 1].end;

    const monthTotals = new Map(months.map((m) => [m.key, 0]));

    // Aggregate paid charges in the window by month
    const chargesByMonth = await ChargeModel.aggregate([
      {
        $match: {
          userId,
          status: "paid",
          chargedAt: { $gte: windowStart, $lt: windowEnd },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m", date: "$chargedAt" },
          },
          total: {
            $sum: {
              $abs: {
                $toDouble: {
                  $ifNull: ["$amount", 0],
                },
              },
            },
          },
        },
      },
    ]);

    chargesByMonth.forEach((row) => {
      if (monthTotals.has(row._id)) {
        monthTotals.set(row._id, round2(row.total));
      }
    });

    const lifetimePaidCharges = await ChargeModel.aggregate([
      {
        $match: { userId, status: "paid" },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $abs: {
                $toDouble: {
                  $ifNull: ["$amount", 0],
                },
              },
            },
          },
        },
      },
    ]);

    const subs = await SubscriptionModel.find({ userId }).lean();
    const activeSubs = subs.filter((s) => !s.deletedAt && s.status !== "canceled");

    // Lifetime total
    let lifetimeTotal = lifetimePaidCharges.length
      ? lifetimePaidCharges[0].total || 0
      : activeSubs.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
    lifetimeTotal = round2(lifetimeTotal);

    // Monthly recurring
    const monthlyRecurring = round2(
      activeSubs.reduce((sum, s) => {
        const amt =
          s.monthlyAmount ??
          s.estimatedMonthlySpend ??
          computeMonthlyAmountFromCycle(s.confirmedBillingCycle || s.billingCycle, s.confirmedAmount ?? s.amount);
        return sum + (Number(amt) || 0);
      }, 0)
    );

    const activeCount = activeSubs.length;

    const last6Months = months.map((m) => ({
      key: m.key,
      label: m.label,
      year: Number(m.key.split("-")[0]),
      month: Number(m.key.split("-")[1]),
      total: round2(monthTotals.get(m.key) || 0),
    }));

    res.json({
      lifetimeTotal,
      monthlyRecurring,
      activeCount,
      last6Months,
    });
  } catch (err) {
    next(err);
  }
}
