export type Billing = "monthly" | "yearly"

export interface Plan {
  id: string
  name: string
  blurb: string
  monthly: number
  features: string[]
  featured?: boolean
}

export const PLANS: Plan[] = [
  { id: "hobby", name: "Hobby", blurb: "For side projects.", monthly: 0, features: ["1 site", "Community support"] },
  {
    id: "pro",
    name: "Pro",
    blurb: "For growing teams.",
    monthly: 24,
    featured: true,
    features: ["Unlimited sites", "Preview deployments", "Email support"],
  },
  { id: "scale", name: "Scale", blurb: "For serious traffic.", monthly: 96, features: ["SSO", "Audit log", "99.99% SLA"] },
]
