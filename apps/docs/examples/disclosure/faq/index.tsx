import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/disclosure'

const faqs = [
  {
    id: 'billing',
    q: 'When am I billed?',
    a: 'On the same day each month you subscribed. Adding a seat part-way through is prorated and appears on the next invoice.',
  },
  {
    id: 'export',
    q: 'Can I export my data?',
    a: 'Yes. Settings → Data → Export writes every project as JSON and Markdown, and the archive is emailed to the account owner.',
  },
  {
    id: 'sso',
    q: 'Do you support single sign-on?',
    a: 'SAML and OIDC are on the Business plan. Until then, members can sign in with Google or a magic link.',
  },
  {
    id: 'legacy',
    q: 'Legacy API keys',
    a: 'Keys created before 2024 have been retired.',
    disabled: true,
  },
]

// The default variant: hairline-separated rows with no container. Only one
// panel is open at a time (react-aria's default for a DisclosureGroup).
export default function Faq() {
  return (
    <div className="mx-auto max-w-lg">
      <Accordion defaultExpandedKeys={['billing']}>
        {faqs.map((f) => (
          <AccordionItem key={f.id} id={f.id} isDisabled={f.disabled}>
            <AccordionTrigger>{f.q}</AccordionTrigger>
            <AccordionContent>{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
