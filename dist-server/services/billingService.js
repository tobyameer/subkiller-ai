import { stripe } from "../config/stripe";
import { env } from "../config/env";
import { UserModel } from "../models/User";
export async function createCheckoutSession(userId, plan) {
    const priceId = plan === "pro" ? env.stripePricePro : env.stripePricePremium;
    const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        customer_email: (await UserModel.findById(userId))?.email,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${env.frontendOrigin}/dashboard?checkout=success`,
        cancel_url: `${env.frontendOrigin}/pricing?checkout=cancel`,
        metadata: { userId },
    });
    return session.url;
}
export async function getPortalUrl(customerId) {
    const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${env.frontendOrigin}/dashboard`,
    });
    return portal.url;
}
