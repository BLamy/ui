import type { Billing, Plan } from "./plans"

export function PricingCard({ plan, billing }: { plan: Plan; billing: Billing }) {
  const price = billing === "yearly" ? Math.round((plan.monthly * 10) / 12) : plan.monthly
  return (
    <article className={plan.featured ? "pricing-card pricing-card-featured" : "pricing-card"}>
      {plan.featured ? <span className="pricing-ribbon">Most popular</span> : null}
      <h4>{plan.name}</h4>
      <p className="pricing-blurb">{plan.blurb}</p>
      <p className="pricing-price">
        <strong>${price}</strong>
        <span>/ month{billing === "yearly" ? ", billed yearly" : ""}</span>
      </p>
      <ul>
        {plan.features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      <button type="button">{plan.monthly === 0 ? "Start free" : `Choose ${plan.name}`}</button>
    </article>
  )
}
