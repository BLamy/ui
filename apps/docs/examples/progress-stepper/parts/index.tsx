import { ProgressStepperItem, ProgressStepperItemIcon, ProgressStepperItemLabel, ProgressStepper, ProgressStepperItemTrack, ProgressStepperItemDescription } from '@/components/ui/progress-stepper'
import { Spinner } from '@/components/ui/spinner'
import { Icon } from '@/lib/icon'

// The parts, for what `steps` can't say: a time under each label, and a
// spinner as the current step's marker. Complete steps wear a check badge.
export default function Parts() {
  return (
    <div className="mx-auto w-full max-w-md">
      <ProgressStepper current={2} labels aria-label="Delivery">
        <ProgressStepperItem icon={<Icon name="check-circle" size={22} />} label="Placed" description="12:04" />
        <ProgressStepperItem icon={<Icon name="archivebox" size={22} />} label="Packed" description="12:19" />
        <ProgressStepperItem>
          <ProgressStepperItemIcon><Spinner size={18} /></ProgressStepperItemIcon>
          <ProgressStepperItemTrack />
          <span className="flex min-w-0 max-w-full flex-col items-center">
            <ProgressStepperItemLabel>On the way</ProgressStepperItemLabel>
            <ProgressStepperItemDescription>About 8 min</ProgressStepperItemDescription>
          </span>
        </ProgressStepperItem>
        <ProgressStepperItem icon={<Icon name="house" size={22} />} label="Delivered" />
      </ProgressStepper>
    </div>
  )
}
