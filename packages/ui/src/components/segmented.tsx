import type { CSSProperties, ReactNode } from 'react';
import { Radio, RadioGroup, SelectionIndicator, SelectionIndicatorContext } from 'react-aria-components';
import { Haptics } from '../lib/haptics';
import { cn } from '../lib/utils';

/** The sliding selected card (react-aria's SelectionIndicator), shared by Segmented, Tabs and ToggleGroup. It sits
    behind the labels (the group is `isolate`), and width/height transition too, so it resizes between unequal items. */
export const segmentIndicator =
  'absolute top-0 left-0 -z-1 size-full rounded-[inherit] bg-card shadow-[0_1px_4px_rgba(0,0,0,.14)] transition-[translate,width,height] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none';

export interface SegmentedOption {
  id: string;
  label: ReactNode;
}

export interface SegmentedProps {
  options: SegmentedOption[];
  value: string;
  onChange: (id: string) => void;
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
}

/** iOS segmented control on react-aria's RadioGroup: arrows move and select, one tick per change. The selected
    card is one element that slides (and resizes) to the new segment on the smooth spring. */
export function Segmented({ options, value, onChange, className, style, ...rest }: SegmentedProps) {
  return (
    <RadioGroup
      data-slot="segmented"
      aria-label={rest['aria-label'] || 'Segmented control'}
      orientation="horizontal"
      value={value}
      onChange={(id) => { if (id === value) return; Haptics.selection(); onChange(id); }}
      className={cn('isolate flex gap-0.5 rounded-[9px] bg-secondary p-0.5', className)}
      style={style}
    >
      {options.map((o) => (
        <Radio
          key={o.id}
          value={o.id}
          className="bl-btn relative flex flex-1 cursor-pointer items-center justify-center rounded-[7px] px-3 py-[5px] text-[13px] font-semibold whitespace-nowrap text-foreground outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring"
        >
          {/* react-aria's Radio doesn't feed SelectionIndicator (only RadioField does), so say which one is selected. */}
          <SelectionIndicatorContext.Provider value={{ isSelected: o.id === value }}>
            <SelectionIndicator data-slot="segmented-indicator" className={segmentIndicator} />
          </SelectionIndicatorContext.Provider>
          {o.label}
        </Radio>
      ))}
    </RadioGroup>
  );
}
