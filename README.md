# Kishin Store

A custom store website for Kishin Skyblock, built on the Tebex Headless API.
Tebex still handles the basket, the payment and the delivery (your `credits give {username} ...`
commands); this site only shows your packs in the Kishin design and sends players to Tebex's checkout.

No build step: it's plain HTML, CSS and JavaScript.

## 1. Settings

Open `assets/config.js` and fill in:

| Setting | What |
|---|---|
| `webstoreId` | Your Tebex **webstore identifier** (public token). It's public and safe to put here. **Never** put a private/secret key in this site. |
| `serverIp` | Shown in the hero with a copy button and the live player count. |
| `discord` | Your Discord invite link. |
| `creditsCategory` | The Tebex category to show (`"Credits"`). `""` shows every category. |
| `badges` | Ribbons by credit amount, e.g. `"2000": "Most popular"`. |
| `announcement` | Optional bar at the top, e.g. a sale. `""` hides it. |

Until `webstoreId` is set the site runs in **preview mode** with example packs.

## 2. Put it on GitHub

1. Create a free account on github.com and a new repository, e.g. `kishin-store`.
2. Upload every file and the `assets` folder ("Add file" → "Upload files"), then "Commit changes".

## 3. Deploy on Vercel (free)

1. Sign in on vercel.com with your GitHub account.
2. "Add New" → "Project" → import `kishin-store`.
3. Framework preset: **Other**. Leave the build command and output directory empty.
4. "Deploy". Your store is live at `https://kishin-store.vercel.app` (or similar).

Every change you commit on GitHub goes live automatically in about 30 seconds.

## 4. Your own domain (optional)

Vercel → your project → Settings → Domains → add `store.kishin.gg`, then add the DNS record Vercel shows
you at your domain provider.

## 5. Tebex

- Packages come straight from Tebex: name, price and sales. Change them in Tebex, the site follows.
- The credit amount is read from the package name (`1,000 Credits` → 1000), so keep the number in the name.
- Coupons and creator codes typed on the site are applied at checkout.
- Payment goal, recent payments and top customer modules you enable in Tebex show up in the "Community"
  section automatically.
