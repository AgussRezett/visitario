import { ListboxField, type SelectProps } from './Select'

export interface MultiSelectProps extends Omit<SelectProps, 'value' | 'onChange' | 'placeholder'> {
  /** The values chosen; none means all. */
  values: string[]
  onChange: (values: string[]) => void
  /** What none chosen means, first in the list and on the button: "Todas las zonas". */
  allLabel: string
  /** How to count several on the button: "zonas" → "Almagro +2", or "3 zonas" when long. */
  noun: string
}

/**
 * A filter of several at once: "Almagro" and "Villa Urquiza", or every one. Same list as
 * Select (top layer, sheet on phones, keyboard, search); picking ticks and the list stays
 * open until "Listo" or a tap outside.
 */
export function MultiSelect({ values, onChange, allLabel, noun, options, ...props }: MultiSelectProps) {
  const chosen = options.filter((o) => values.includes(String(o.value)))
  const first = chosen[0]
  const text = !first ? allLabel : chosen.length === 1 ? first.selectedLabel ?? first.label : `${first.label} +${chosen.length - 1}`
  const toggle = (v: string) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v])
  return (
    <ListboxField
      {...props}
      options={options}
      multiple
      chosen={values}
      onPick={toggle}
      onClear={() => onChange([])}
      allLabel={allLabel}
      text={<span title={chosen.length > 1 ? chosen.map((c) => c.label).join(', ') : undefined}>{chosen.length > 2 ? `${chosen.length} ${noun}` : text}</span>}
    />
  )
}
