import { env } from "./env.js";

let plaidClient = null;
let plaidAvailable = false;

try {
  if (env.plaidClientId && env.plaidSecret) {
    // Dynamically import to avoid crash when package is missing
    const { Configuration, PlaidApi, PlaidEnvironments } = await import("plaid");
    const basePath = PlaidEnvironments[env.plaidEnv] || PlaidEnvironments.sandbox;
    const configuration = new Configuration({
      basePath,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": env.plaidClientId,
          "PLAID-SECRET": env.plaidSecret,
        },
      },
    });
    plaidClient = new PlaidApi(configuration);
    plaidAvailable = true;
  }
} catch (err) {
  plaidClient = null;
  plaidAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[plaid] not available:", err.message);
}

export { plaidClient, plaidAvailable };
