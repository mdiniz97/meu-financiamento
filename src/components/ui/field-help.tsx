'use client';

import { useState, type ReactNode } from 'react';
import { Popover } from '@base-ui/react/popover';
import { CircleHelp } from 'lucide-react';
import { Label } from '@/components/ui/label';

export function FieldHelp({
  htmlFor,
  label,
  help,
  children,
  group = false,
}: {
  htmlFor: string;
  label: string;
  help: ReactNode;
  children: ReactNode;
  group?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const descriptionId = `${htmlFor}-help`;
  const popupId = `${htmlFor}-help-popup`;

  const helpTrigger = (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        type="button"
        openOnHover
        delay={0}
        id={`${htmlFor}-help-trigger`}
        data-field-help-trigger={htmlFor}
        aria-label={`Ajuda sobre ${label}`}
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) setOpen(true);
        }}
        className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CircleHelp aria-hidden className="size-3.5" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" sideOffset={6} className="isolate z-50">
          <Popover.Popup
            id={popupId}
            data-field-help-popup={htmlFor}
            initialFocus={false}
            className="z-50 w-fit max-w-xs origin-(--transform-origin) rounded-md bg-foreground px-3 py-2 text-xs text-background shadow-md outline-none data-ending-style:opacity-0 data-starting-style:opacity-0"
          >
            <Popover.Description>{help}</Popover.Description>
            <Popover.Arrow className="size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=top]:-bottom-2.5" />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );

  if (group) {
    return (
      <fieldset
        id={htmlFor}
        data-field-help-group={htmlFor}
        aria-describedby={descriptionId}
        className="flex min-w-0 flex-col gap-1.5"
      >
        <legend className="float-left text-sm font-medium leading-none">{label}</legend>
        <div className="float-left ml-1.5 inline-flex">{helpTrigger}</div>
        <span id={descriptionId} data-field-help-description={htmlFor} className="sr-only">
          {help}
        </span>
        <div className="clear-both contents">{children}</div>
      </fieldset>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id={descriptionId} data-field-help-description={htmlFor} className="sr-only">
        {help}
      </span>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={htmlFor}>{label}</Label>
        {helpTrigger}
      </div>
      {children}
    </div>
  );
}
