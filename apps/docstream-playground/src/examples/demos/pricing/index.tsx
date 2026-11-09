import { PricingCard } from "./PricingCard"
import { PLANS, type Billing } from "./plans"
import "./pricing.css"

export default function Pricing({ variant = "monthly" }: { variant?: string }) {
  const billing: Billing = variant === "yearly" ? "yearly" : "monthly"
  return (
    <div className="pricing">
      <header className="pricing-head">
        <h3>Simple pricing</h3>
        <p>{billing === "yearly" ? "Two months free when you pay yearly." : "Cancel any time. No setup fees."}</p>
      </header>
      <div className="pricing-grid">
        {PLANS.map((plan) => (
          <PricingCard key={plan.id} plan={plan} billing={billing} />
        ))}
      </div>
    </div>
  )
}
