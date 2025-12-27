/**
 * Knowledge base for SubKiller AI Copilot
 * Contains product information, features, setup steps, and troubleshooting tips
 */

export const knowledgeBase = {
  product: {
    name: "SubKiller",
    description: "SubKiller is a subscription tracking app that helps you discover and manage your recurring subscriptions by scanning your Gmail inbox for subscription receipts and billing emails.",
    tagline: "See every charge. Kill the waste.",
  },

  features: [
    {
      name: "Gmail Scanning",
      description: "Automatically scans your Gmail inbox to find subscription receipts and billing emails. Supports PDF attachments (like Spotify, Talabat receipts).",
    },
    {
      name: "Subscription Tracking",
      description: "Tracks all your subscriptions in one place with details like service name, amount, billing cycle, next renewal date, and status.",
    },
    {
      name: "Spending Analysis",
      description: "Provides insights into your subscription spending including monthly totals, trends, and spending breakdowns by category.",
    },
    {
      name: "Human-in-the-Loop Review",
      description: "Uses a verification system to ensure near-100% accuracy. You review detected subscriptions before they're added to your account.",
    },
    {
      name: "AI Copilot",
      description: "AI-powered assistant that answers questions about your subscriptions, spending patterns, and helps you optimize your recurring charges.",
    },
  ],

  setup: {
    connectGmail: [
      "1. Click 'Connect Gmail' button on the Dashboard or Subscriptions page",
      "2. Sign in with your Google account",
      "3. Grant permission to access Gmail (read-only access)",
      "4. Once connected, you can start scanning your inbox",
    ],
    scanInbox: [
      "1. Click 'Scan Gmail' button",
      "2. Choose scan mode: Fast (shows levels 4-5), Strict (shows levels 3-5), or Show All",
      "3. Review detected subscriptions as they appear",
      "4. Verify or decline each subscription candidate",
      "5. Verified subscriptions are added to your account",
    ],
  },

  commonErrors: [
    {
      error: "401 /auth/me",
      description: "Authentication failed or session expired",
      solution: "Log out and log back in. If the issue persists, clear cookies and try again.",
    },
    {
      error: "Backend not reachable",
      description: "Frontend cannot connect to backend server",
      solution: "Check that the backend server is running. Verify VITE_API_URL is set correctly in frontend .env file.",
    },
    {
      error: "OAuth invalid_client",
      description: "Google OAuth misconfiguration",
      solution: "This is a server-side configuration issue. Check that GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI are set correctly.",
    },
    {
      error: "Insufficient permissions",
      description: "Gmail API permissions not granted",
      solution: "Disconnect Gmail and reconnect, ensuring you grant all requested permissions including Gmail read access.",
    },
    {
      error: "Token expired/revoked",
      description: "Gmail OAuth token has expired or been revoked",
      solution: "Disconnect Gmail and reconnect to refresh the token.",
    },
  ],

  pricing: {
    free: {
      tier: "Free",
      features: [
        "Basic Gmail scanning (limited scans per day)",
        "Subscription tracking",
        "Basic spending insights",
      ],
      limitations: [
        "Limited number of scans per day",
        "AI Copilot not available",
      ],
    },
    pro: {
      tier: "Pro",
      features: [
        "Unlimited Gmail scans",
        "AI Copilot access",
        "Advanced spending analysis",
        "Email + card matching (if card linked)",
        "12-month history scan",
        "Priority subscription detection",
      ],
    },
  },

  troubleshooting: [
    {
      issue: "No subscriptions detected",
      solutions: [
        "Ensure you've connected Gmail and granted proper permissions",
        "Run a scan and check for pending review items",
        "Some subscriptions may be in PDF attachments - the system scans these automatically",
        "Check that your emails contain billing/receipt keywords",
      ],
    },
    {
      issue: "Scan shows 0 messages",
      solutions: [
        "Check that you have subscription-related emails in your inbox",
        "The scan searches for receipts, invoices, and billing emails from the last 365 days",
        "Try a different scan mode (Strict or Show All)",
        "Verify Gmail connection is still active",
      ],
    },
    {
      issue: "Subscription amounts are incorrect",
      solutions: [
        "Review and edit subscription details when verifying",
        "The AI extraction is approximate - always verify amounts",
        "Some emails may not contain the full subscription price",
      ],
    },
    {
      issue: "Newsletter subscription not working",
      solutions: [
        "Check that backend server is running",
        "Verify SMTP is configured if emails should be sent (otherwise uses mock mode)",
        "Check browser console for errors",
      ],
    },
  ],

  support: {
    email: "support@subkiller.com", // Placeholder - update with actual support email
    note: "For issues not covered here, please contact support or check the documentation.",
  },
};

/**
 * Format knowledge base as text for inclusion in AI prompts
 */
export function formatKnowledgeBase() {
  let text = `# SubKiller Product Information\n\n`;
  
  text += `## Product Description\n`;
  text += `${knowledgeBase.product.description}\n\n`;
  
  text += `## Features\n`;
  knowledgeBase.features.forEach((feature) => {
    text += `- **${feature.name}**: ${feature.description}\n`;
  });
  text += `\n`;
  
  text += `## Setup Steps\n\n`;
  text += `### Connect Gmail\n`;
  text += knowledgeBase.setup.connectGmail.join(`\n`) + `\n\n`;
  text += `### Scan Inbox\n`;
  text += knowledgeBase.setup.scanInbox.join(`\n`) + `\n\n`;
  
  text += `## Common Errors & Solutions\n`;
  knowledgeBase.commonErrors.forEach((err) => {
    text += `- **${err.error}**: ${err.description}\n`;
    text += `  Solution: ${err.solution}\n`;
  });
  text += `\n`;
  
  text += `## Pricing Tiers\n`;
  text += `### Free Tier\n`;
  text += `Features: ${knowledgeBase.pricing.free.features.join(`, `)}\n`;
  text += `Limitations: ${knowledgeBase.pricing.free.limitations.join(`, `)}\n\n`;
  text += `### Pro Tier\n`;
  text += `Features: ${knowledgeBase.pricing.pro.features.join(`, `)}\n\n`;
  
  text += `## Troubleshooting\n`;
  knowledgeBase.troubleshooting.forEach((item) => {
    text += `### ${item.issue}\n`;
    item.solutions.forEach((solution) => {
      text += `- ${solution}\n`;
    });
    text += `\n`;
  });
  
  text += `## Support\n`;
  text += `For additional help, contact: ${knowledgeBase.support.email}\n`;
  
  return text;
}

