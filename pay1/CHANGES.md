# Pay-Together — Finalization Notes

This document explains what was added/fixed to bring the project in line with
the FYP documentation (SRS functional requirements FR1–FR9) and how to get
it running.

## 1. What was missing before

The documentation's core feature — **expense tracking** (FR6 Add Expenses,
FR7 View Total/Share, FR8 Edit Expense) — had no implementation at all.
`apps/expencess`, `apps/reports` and `api` were empty stub apps. FR3 (Edit
Profile) and FR9 (Logout, server-side) were also missing, and the dashboard
showed hardcoded zeros.

## 2. What was built

**Expense tracking (`apps/expencess`)**
- `Expense` model (tour, paid_by, title, amount, notes, timestamps) + migration.
- `services.py`: equal-split balance calculator shared by the tour summary
  and dashboard summary endpoints.
- API: `GET/POST /api/tours/<id>/expenses/`, `GET/PATCH/DELETE
  /api/tours/<id>/expenses/<id>/` (only the member who logged an expense can
  edit/delete it — matches the SRS business rule), `GET
  /api/tours/<id>/summary/` (total spent, per-member paid/share/balance).
- Permission: only the tour's creator or joined members can view/add expenses.

**Profile & logout (FR3, FR9)**
- `PATCH /api/profile/` to edit name/phone/photo; `/api/profile/change-password/`.
- `POST /api/logout/` blacklists the refresh token (added
  `rest_framework_simplejwt.token_blacklist` to `INSTALLED_APPS` — **run
  migrations**, see below).
- New page: `/profile/`.

**Dashboard (`apps/core`)**
- `GET /dashboard/api/summary/` returns real totals (tours, members,
  expenses, net balance) across every tour the user belongs to.
- Sidebar/cards rewired to show live data instead of static zeros; dead nav
  links removed/redirected to real pages.

**Frontend polish**
- Dashboard redesigned (gradient sidebar, live stat cards, clearer nav).
- Added an "Expenses" ledger section to the tour detail page — matches the
  page's existing bespoke editorial design — with an add-expense form, an
  expense list (delete for your own entries), and a live balance panel per
  member ("owes" / "is owed").
- Added an Inter web font + favicon in the shared base template for a more
  cohesive look across the Tailwind-based pages.
- Fixed a stray unclosed `<div>` in the tours list page and cleaned up dead/
  duplicated code left in `apps/tours/views.py`.

**Housekeeping**
- Registered `User` in Django admin.
- Converted `requirements.txt` from UTF-16 to UTF-8 (the original encoding
  can break `pip install -r requirements.txt` on some systems).
- Removed the committed `myenv/` virtualenv and `staticfiles/` build output
  from this delivered copy — regenerate them locally instead of shipping them.

## 3. Getting it running

```bash
cd pay1
python -m venv myenv
# Windows: myenv\Scripts\activate      |  macOS/Linux: source myenv/bin/activate
pip install -r requirements.txt

python manage.py migrate          # creates the Expense table + the JWT blacklist tables
python manage.py createsuperuser  # optional, for /admin/
python manage.py collectstatic    # optional, only needed for production-style serving

python manage.py runserver
```

Then visit `http://127.0.0.1:8000/register/` to create an account, create a
tour, share its join code, and log expenses from the tour's detail page.

## 4. Suggested next steps (beyond this pass)

- The SRS's `reports` app is still a stub; the tour summary panel already
  covers FR7, but a dedicated printable/export report could live there.
- `mysqlclient` is listed in requirements but `settings.py` still points at
  SQLite — switch `DATABASES` if you want to actually use MySQL per the docs.
- No automated tests were added for the new expense endpoints — worth adding
  before a viva/demo if time allows.
