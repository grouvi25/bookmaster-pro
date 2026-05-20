"""Замена generic ListSkeleton на специализированные скелетоны
по карте file -> component."""
import re
from pathlib import Path

BASE = Path(__file__).parent / "apps/mini-app/src"

# (relative path, current import set, replacements)
# replacements: list of (old fragment, new fragment)
PLAN = [
    # ── master ──
    ("pages/master/Schedule.tsx", {
        "imports": "BookingCardSkeleton",
        "replacements": [
            ('<ListSkeleton count={5} />', '<BookingCardSkeleton count={5} />'),
        ],
    }),
    ("pages/master/Clients.tsx", {
        "imports": "ClientCardSkeleton",
        "replacements": [
            ('<ListSkeleton count={5} />', '<ClientCardSkeleton count={5} />'),
        ],
    }),
    ("pages/master/Services.tsx", {
        "imports": "ServiceCardSkeleton",
        "replacements": [
            ('return <ListSkeleton count={4} />;',
             'return <ServiceCardSkeleton count={4} />;'),
        ],
    }),
    ("pages/master/Tools.tsx", {
        "imports": "ServiceCardSkeleton",
        "replacements": [
            # Первое использование (промо)
            ('return <div className="px-screen-x"><ListSkeleton count={3} /></div>;',
             'return <ServiceCardSkeleton count={3} />;'),
        ],
    }),
    ("pages/master/Consultations.tsx", {
        "imports": "BookingCardSkeleton, StatGridSkeleton",
        "replacements": [
            # 1-й loading (список консультаций)
            ('  if (isLoading) return <ListSkeleton count={3} />;',
             '  if (isLoading) return <BookingCardSkeleton count={3} />;'),
            # 2-й loading (статистика)
            ('  if (isLoading) return <ListSkeleton count={2} />;',
             '  if (isLoading) return <StatGridSkeleton count={4} />;'),
        ],
    }),
    ("pages/master/Settings.tsx", {
        "imports": "ServiceCardSkeleton, TicketCardSkeleton",
        "replacements": [
            # ServicesTab: первый ListSkeleton(3) => ServiceCardSkeleton(3)
            # SupportTab: второй ListSkeleton(3) => TicketCardSkeleton(3)
            # Делаем "first" и "second" через индекс в общем replace ниже вручную.
        ],
        "manual": True,
    }),
    ("pages/master/WorkSchedule.tsx", {
        "imports": "FormSkeleton",
        "replacements": [
            ('<div className="px-screen-x py-section-y"><ListSkeleton count={7} /></div>',
             '<div className="px-screen-x py-section-y"><FormSkeleton rows={7} /></div>'),
        ],
    }),
    # ── client ──
    ("pages/client/MyBookings.tsx", {
        "imports": "MyBookingCardSkeleton",
        "replacements": [
            ('<div className="px-screen-x py-section-y"><ListSkeleton count={4} /></div>',
             '<div className="px-screen-x py-section-y"><MyBookingCardSkeleton count={4} /></div>'),
        ],
    }),
    ("pages/client/MasterProfile.tsx", {
        "imports": "MasterProfileSkeleton",
        "replacements": [
            ('  if (isLoading) return <PageSkeleton />;',
             '  if (isLoading) return <MasterProfileSkeleton />;'),
        ],
    }),
    # ── superadmin ──
    ("pages/superadmin/tabs/DashboardTab.tsx", {
        "imports": "StatGridSkeleton",
        "replacements": [
            ('  if (isLoading) return <ListSkeleton count={4} />;',
             '  if (isLoading) return <StatGridSkeleton count={8} />;'),
        ],
    }),
    ("pages/superadmin/tabs/MastersTab.tsx", {
        "imports": "ClientCardSkeleton",
        "replacements": [
            ('  if (isLoading) return <ListSkeleton count={4} />;',
             '  if (isLoading) return <ClientCardSkeleton count={5} />;'),
        ],
    }),
    ("pages/superadmin/tabs/FinanceTab.tsx", {
        "imports": "StatGridSkeleton",
        "replacements": [
            ('  if (isLoading) return <ListSkeleton count={4} />;',
             '  if (isLoading) return <StatGridSkeleton count={8} />;'),
        ],
    }),
    ("pages/superadmin/tabs/GrowthTab.tsx", {
        "imports": "StatGridSkeleton",
        "replacements": [
            ('  if (isLoading) return <ListSkeleton count={3} />;',
             '  if (isLoading) return <StatGridSkeleton count={3} />;'),
        ],
    }),
    ("pages/superadmin/tabs/PromoCodesTab.tsx", {
        "imports": "TicketCardSkeleton",
        "replacements": [
            ('  if (isLoading) return <ListSkeleton count={3} />;',
             '  if (isLoading) return <TicketCardSkeleton count={3} />;'),
        ],
    }),
    ("pages/superadmin/tabs/SettingsTab.tsx", {
        "imports": "FormSkeleton",
        "replacements": [
            ('  if (isLoading) return <ListSkeleton count={2} />;',
             '  if (isLoading) return <FormSkeleton rows={5} />;'),
        ],
    }),
    ("pages/superadmin/tabs/SLATab.tsx", {
        "imports": "StatGridSkeleton",
        "replacements": [
            ('  if (isLoading) return <ListSkeleton count={3} />;',
             '  if (isLoading) return <StatGridSkeleton count={3} />;'),
        ],
    }),
    ("pages/superadmin/tabs/TicketsTab.tsx", {
        "imports": "TicketCardSkeleton",
        "replacements": [
            ('  if (isLoading) return <ListSkeleton count={4} />;',
             '  if (isLoading) return <TicketCardSkeleton count={4} />;'),
        ],
    }),
    ("pages/superadmin/tabs/AuditTab.tsx", {
        "imports": "CardSkeleton",
        "replacements": [
            ('  if (isLoading) return <ListSkeleton count={4} />;',
             '  if (isLoading) return (\n    <div className="flex flex-col gap-card-gap">\n      {[0,1,2,3].map(i => <CardSkeleton key={i} />)}\n    </div>\n  );'),
        ],
    }),
    # ── moderator ──
    ("pages/moderator/tabs/TicketsTab.tsx", {
        "imports": "TicketCardSkeleton",
        "replacements": [
            ('<ListSkeleton count={3} />', '<TicketCardSkeleton count={3} />'),
        ],
    }),
    ("pages/moderator/tabs/VerificationTab.tsx", {
        "imports": "ClientCardSkeleton",
        "replacements": [
            ('  if (isLoading) return <ListSkeleton count={3} />;',
             '  if (isLoading) return <ClientCardSkeleton count={3} />;'),
        ],
    }),
    # moderator/ReviewsTab оставляем generic ListSkeleton(3) — он подходит
]


def patch_imports(text: str, new_components: str, current_used: list[str]) -> str:
    """
    Если в файле уже есть `import { ... } from '@/shared/ui/Skeleton'`,
    добавляем new_components (запятая если ещё нет такого).
    Также удаляем 'ListSkeleton', если он больше не используется.
    """
    pattern = r"(import\s*\{)([^}]+)(\}\s*from\s*['\"]@/shared/ui/Skeleton['\"];?)"
    m = re.search(pattern, text)
    if not m:
        return text

    inside = m.group(2).strip()
    items = [s.strip() for s in inside.split(",") if s.strip()]

    # Добавим новые компоненты (если ещё не там)
    new_items_to_add = [c.strip() for c in new_components.split(",")]
    for c in new_items_to_add:
        if c not in items:
            items.append(c)

    # Удалим ListSkeleton если он не используется в коде
    # Считаем после уже выполненных replacements!
    if "ListSkeleton" in items and "<ListSkeleton" not in text:
        items.remove("ListSkeleton")

    new_inside = ", ".join(items)
    return text[:m.start()] + f"import {{ {new_inside} }} from '@/shared/ui/Skeleton';" + text[m.end():]


for entry in PLAN:
    rel = entry[0]
    cfg = entry[1]
    p = BASE / rel
    if not p.exists():
        print(f"[SKIP] {rel}")
        continue

    text = p.read_text(encoding="utf-8")
    orig = text

    if cfg.get("manual"):
        # Settings.tsx: первый <ListSkeleton count={3}> в ServicesTab → ServiceCardSkeleton(3)
        # Второй <ListSkeleton count={3}> в SupportTab → TicketCardSkeleton(3)
        # Используем split на 2 части и точечно меняем
        first_idx = text.find("<ListSkeleton count={3} />")
        if first_idx == -1:
            print(f"[--] {rel}: no ListSkeleton(3) found")
            continue
        second_idx = text.find("<ListSkeleton count={3} />", first_idx + 1)
        if second_idx == -1:
            print(f"[--] {rel}: only one ListSkeleton(3)")
            continue
        # Меняем второй сначала (чтобы индексы не сдвинулись)
        text = (
            text[:second_idx]
            + "<TicketCardSkeleton count={3} />"
            + text[second_idx + len("<ListSkeleton count={3} />"):]
        )
        text = (
            text[:first_idx]
            + "<ServiceCardSkeleton count={3} />"
            + text[first_idx + len("<ListSkeleton count={3} />"):]
        )
    else:
        for old, new in cfg["replacements"]:
            text = text.replace(old, new)

    if cfg.get("imports"):
        text = patch_imports(text, cfg["imports"], [])

    if text != orig:
        p.write_text(text, encoding="utf-8")
        print(f"[OK] {rel}")
    else:
        print(f"[--] {rel}: no change")
