/**
 * Onboarding - shown on first launch when no workspace roots are configured.
 */

export function Onboarding() {
  return <div .onboarding>
    <div .col .gap-4 .m-auto .p-6 .text-center style="min-width:300dip; max-width:500dip;">
      <i .icon-folder .mx-auto style="font-size:40dip; size:40dip; line-height:40dip; color:color(fg-3);" />
      <div .col .gap-2>
        <h2 .text-2xl .semibold>Add a workspace</h2>
        <p .fg-2 .text-base>Pick a folder that contains your projects. RepoSweep will scan it and find cleanup targets.</p>
      </div>
      <div .row .gap-3 .mx-auto .mt-2>
        <button .primary .lg #auto-detect><i .icon-zap /> Auto-detect</button>
        <button .lg #add-workspace><i .icon-folder /> Browse...</button>
      </div>
    </div>
  </div>;
}
