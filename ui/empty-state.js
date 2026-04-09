/**
 * EmptyState — reusable centered placeholder for empty pages/sections.
 *
 * Props:
 *   icon:    string — lucide icon class (e.g. "icon-search")
 *   title:   string — heading text
 *   message: string — description text
 */
export function EmptyState(props) {
  return <div .fill>
    <div .col .gap-2 .m-auto .text-center style="width:max-content;">
      <i class={props.icon} style="font-size:28dip; size:28dip; line-height:28dip; color:color(fg-3); horizontal-align:center;" />
      <h3 .text-lg .medium>{props.title}</h3>
      <p .fg-2 .text-sm>{props.message}</p>
    </div>
  </div>;
}
