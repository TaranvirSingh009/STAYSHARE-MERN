# StayShare

StayShare is a room booking app with an optional room sharing flow. Book a stay, look for a partner, and split the recorded room cost if someone joins.

![StayShare home page showing sample stays](screenshots/stayshare-home.png)

## A closer look

From browsing stays to sharing a room, managing a listing, or keeping an eye on the whole marketplace, these screens show the main StayShare flows.
Screenshots use representative sample listings and demo activity.

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="screenshots/shared-rooms.png" alt="Shared rooms page with stays looking for a booking partner" width="100%">
      <strong>Shared rooms</strong><br>
      Browse upcoming stays, see the price split, and join a room.
    </td>
    <td width="50%" valign="top">
      <img src="screenshots/my-bookings.png" alt="Guest bookings with sharing status and booking controls" width="100%">
      <strong>Your bookings</strong><br>
      Keep track of upcoming stays and see when a room has been shared.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="screenshots/host-dashboard.png" alt="Host dashboard for publishing and managing property listings" width="100%">
      <strong>Host dashboard</strong><br>
      Add a space, manage listings, and review upcoming bookings.
    </td>
    <td width="50%" valign="top">
      <img src="screenshots/control-panel.png" alt="Superadmin dashboard with marketplace statistics, users, and listings" width="100%">
      <strong>Marketplace control panel</strong><br>
      View activity, manage roles, and review listings in one place.
    </td>
  </tr>
  <tr>
    <td colspan="2" valign="top">
      <img src="screenshots/register.png" alt="StayShare registration page with guest and host account choices" width="100%">
      <strong>Simple sign up</strong><br>
      Join as a guest or choose the host path to list a place.
    </td>
  </tr>
</table>

## What you can do

- Browse stays by location and property type.
- Book available dates and view upcoming bookings.
- Invite another guest to share a booking, or join an open request.
- List a flat, hotel, or hostel as a host and manage its bookings.
- Manage users, roles, and listings from the superadmin panel.

Bookings use Razorpay Checkout. The server creates each payment order and verifies the payment before confirming the stay. Use Razorpay test credentials while developing; test payments do not charge real money.

## Built with

React, Vite, Express, MongoDB, Mongoose, and JWT authentication. Listing photos can use Cloudinary; without Cloudinary credentials, the backend stores uploads locally.

## Run it locally

You will need Node.js and a MongoDB database. A local MongoDB server or MongoDB Atlas connection works.

### 1. Set up the backend

```sh
cd backend
npm install
```

Copy `backend/.env.example` to `backend/.env` and set `MONGODB_URI`, `ACCESS_TOKEN_SECRET`, and `REFRESH_TOKEN_SECRET`. Use private random values for both token secrets. To enable Razorpay test checkout, add these lines to `backend/.env` using the test keys from the Razorpay Dashboard:

```env
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_test_key_secret
RAZORPAY_CURRENCY=INR
```

Keep the secret in the backend `.env`; never put it in frontend variables or commit it. Cloudinary values are optional. Restart the backend after saving the keys.

In PowerShell, copy the file with:

```powershell
Copy-Item .env.example .env
```

Add the sample listings and start the API:

```sh
npm run seed:demo
npm run dev
```

The sample seed can be run more than once; it will not add duplicate listings. To create demo sign-ins for a local showcase, make sure `.env` points to a development database, then set `$env:ENABLE_DEMO_ACCOUNTS = "true"` and run `npm run seed:demo:accounts` in PowerShell.

The demo seed refuses to run with `NODE_ENV=production` and is opt-in because it creates a superadmin with a shared password. Do not use these demo credentials on a live database.

| Demo role | Email | Password |
| --- | --- | --- |
| Guest | `guest@stayshare.demo` | `StayShareDemo123!` |
| Host | `host@stayshare.demo` | `StayShareDemo123!` |
| Superadmin | `superadmin@stayshare.demo` | `StayShareDemo123!` |

The demo listings include Goa, Jaipur, Manali, Bengaluru, New Delhi, and Chandigarh, and the seed can be rerun without duplicating them.
The login page has buttons to fill each demo account into the sign-in form. To create a private superadmin instead, set `SUPERADMIN_EMAIL` and a private `SUPERADMIN_PASSWORD` in `.env`, then run `npm run seed`.

### 2. Start the frontend

In a second terminal:

```sh
cd frontend
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Vite forwards API and local image requests to the backend on port 5000.

If PowerShell blocks the `npm` command, use `npm.cmd` in the commands above.

## Sharing flow

1. Book a stay for future dates.
2. Choose **Find partner** from your bookings. The request stays open for up to 24 hours, or until check-in.
3. Another guest can join from **Shared rooms**. The booking records half of the total for each guest.
4. If no one joins before the request expires, the original guest remains responsible for the full amount.

## Project layout

```text
backend/    Express API, MongoDB models, routes, and seed scripts
frontend/   React app and Vite configuration
screenshots/ README screenshots
```

## API overview

All API routes use the `/api/v1` prefix.

| Area | Routes |
| --- | --- |
| Auth | Register, login, refresh, logout, current user |
| Properties | Browse, view, list, hide, and restore listings |
| Bookings | Create a Razorpay order, verify payment, view dates and bookings, and cancel |
| Shares | Open requests, create, join, and cancel requests |
| Superadmin | Stats, users, role updates, and user removal |

The backend health endpoint is `GET /api/health`.
## Account verification and approvals

New guest and host accounts include a phone number and gender, then enter a manual review queue for the superadmin. Guests need an approved profile to book or apply to share a room. Hosts need approval before they can publish a listing. New hotel, hostel, and flat listings stay hidden until a superadmin approves them.

Room-share requests are reviewed by the guest who booked the stay. Applications are limited to matching gender profiles; the owner can approve one guest or reject an application from **My bookings**.

Guests who completed a stay can leave one 1–5 star review per booking. Listing cards and detail pages show average ratings and reviews. Use the **Dark** toggle in the top navigation to change themes; the selection is saved in the browser.
"# STAYSHARE-MERN" 
