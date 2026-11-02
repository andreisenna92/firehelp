# Requested functional update

- [x] Apply user-supplied SQL migration for Google login with first-access CPF completion (0008_google_login_first_access_cpf), no code changes.
- [x] Protect verified projetofirehelp@gmail.com as super admin via migration 0007 (role changes and member removal restricted; super admin protected).
- [ ] Extend existing administration for news publishing/images and alert creation/editing/deletion, preserving data and history.
- [ ] Replace Leaflet with Google Maps and preserve report markers and manual selection; connector linked (std_01m6933nvgfg7ts58k2aw4jyfp).
- [ ] Add required occurrence address, neighborhood/city storage, address lookup and high-accuracy current location.
- [ ] Verify permission rules and news/alert flows; report Google Maps validation on an authorized deployed origin.

# Requested account changes

- [x] Resolve first-manager assignment: the first new signup becomes principal manager; keep existing profiles.
- [x] Prepare the minimal implementation plan preserving existing pages, design, data and Vercel deployment.
- [x] Implement private validated unique CPF registration, email/password login, email recovery and editable avatars.
- [x] Implement backend-enforced manager/member permissions and soft account removal preserving contribution references.
- [x] Verify CPF rules, role helpers, private grants, signed-in member profile, sign-out and own post create/edit/delete; build clean, existing seven accounts preserved.
- [ ] Verify first/second signup and simultaneous first-manager assignment: blocked by lack of isolated database with Auth fixture permissions; do not consume the real first signup.
- [ ] Verify successful password login, delivered recovery/confirmation emails and manager actions end-to-end: requires suitable isolated accounts and email access; existing passwords were not requested or changed.