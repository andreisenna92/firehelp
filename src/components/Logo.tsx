import mimoLogo from "@/assets/mimo-logo.png.asset.json";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="relative grid size-9 place-items-center overflow-hidden rounded-xl bg-brand shadow-soft">
        <img
          src={mimoLogo.url}
          alt="Mimo, mascote do FireHelp"
          width={64}
          height={64}
          className="size-9 scale-110 object-cover object-top"
        />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-lg font-extrabold tracking-tight">
            FIRE<span className="text-primary">HELP</span>
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Informação que protege
          </span>
        </span>
      )}
    </span>
  );
}
