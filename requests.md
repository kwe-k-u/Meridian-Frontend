# Meridian Frontend — API Requests Reference

> **Legend:** ✅ = Implemented & wired; ⏳ = Defined in `ApiService` but not wired; ❌ = Not yet implemented (needs endpoint definition)

---

## Auth Page (`/login`, `/signup`)

| # | Method | Endpoint | Description | Status | Request | Response |
|---|--------|----------|-------------|--------|---------|----------|
| 1 | POST | `/auth/register-company` | Register a new company with admin user | ✅ | `{ email, company_name, country, business_type, username, password, password_confirmation }` | `LoginResponse { access_token, token_type, user: UserProfile }` |
| 2 | POST | `/auth/login` | Email/password login | ✅ | `{ email, password }` | `LoginResponse { access_token, token_type, user: UserProfile }` |
| 3 | POST | `/auth/google` | Google OAuth login | ✅ | `{ id_token }` | `LoginResponse { access_token, token_type, user: UserProfile }` |

---

## Forgot Password Page (`/forgot-password`)

| # | Method | Endpoint | Description | Status | Request | Response |
|---|--------|----------|-------------|--------|---------|----------|
| 4 | POST | `/auth/forgot-password` | Request password reset email | ✅ | `{ email }` | `any` (success message) |
| 5 | POST | `/auth/reset-password` | Reset password with token | ✅ | `{ email, token, password, password_confirmation }` | `any` (success message) |

---

## Dashboard (`/app/dashboard`)

| # | Method | Endpoint | Description | Status | Request | Response |
|---|--------|----------|-------------|--------|---------|----------|
| 6 | GET | `/dashboard` | Fetch dashboard stats & latest trips | ✅ | — | `DashboardResponse { user, revenue, outstanding, paid_out, refunds, latest_trips, ai_handled_tasks, pending_review_tasks }` |
| 7 | GET | `/trips` | Latest trips feed (derived from `/trips`) | ⏳ | `?page=1` | `ApiPaginatedResponse<TripResponse>` |
| — | — | Agent activity feed | Real-time agent activity stream | ❌ | — | `AgentFeedItem[]` (currently mock data in `constants/app.ts`) |
| — | — | Guide cards list | Help/onboarding guides | ❌ | — | `GuideCard[]` (currently static in `Dashboard.tsx`) |
| — | — | Onboarding progress | Onboarding tasks read from backend | ❌ | — | `OnboardingTask[]` (currently mock data in `Dashboard.tsx`) |

> **Note:** Dashboard loads `GET /dashboard` via `ApiService.getDashboard()`. The stats widgets and "Trips in motion" use this response. Agent feed, guide cards, and onboarding tasks are all mock/local.

---

## Trips (`/app/trips`)

| # | Method | Endpoint | Description | Status | Request | Response |
|---|--------|----------|-------------|--------|---------|----------|
| 8 | GET | `/trips` | List all trips (paginated) | ✅ | `?page=1` | `ApiPaginatedResponse<TripResponse>` |
| 9 | POST | `/trips` | Create a new trip | ⏳ | `{ company_id, created_by?, trip_name, description?, start_date?, end_date?, budget?, status? }` | `TripResponse` |
| 10 | DELETE | `/trips/:id` | Delete a trip | ⏳ | — | `void` |

> **Note:** Create trip modal currently simulates generation without calling the API. The `createTrip` method exists in `ApiService` but is not wired to the UI.

---

## Trip Detail (`/app/trips/:tripId`)

| # | Method | Endpoint | Description | Status | Request | Response |
|---|--------|----------|-------------|--------|---------|----------|
| 11 | GET | `/trips/:id` | Get single trip with itineraries | ✅ | — | `TripResponse` (includes `itineraries[]` with days/flights/accommodation) |
| 12 | PUT | `/trips/:id` | Update trip metadata | ✅ | `{ trip_name?, description?, start_date?, end_date?, budget?, status? }` | `TripResponse` |
| 13 | PATCH | `/trips/:id/status` | Transition trip status | ✅ | `{ status }` | `TripResponse` |
| 14 | GET | `/trips/:id/costs` | Get trip cost breakdown & payments | ✅ | — | `TripCostResponse { itinerary_costs, payments[], summary }` |

### Itinerary CRUD

| # | Method | Endpoint | Description | Status | Request | Response |
|---|--------|----------|-------------|--------|---------|----------|
| 15 | POST | `/itinerary` | Create a new itinerary option | ✅ | `{ trip_id, created_by?, itinerary_name, description?, start_date?, end_date? }` | `ItineraryResponse` |
| 16 | PUT | `/itinerary/:id` | Update itinerary metadata | ⏳ | `{ itinerary_name?, description?, start_date?, end_date?, status? }` | `ItineraryResponse` |
| 17 | DELETE | `/itinerary/:id` | Delete an itinerary | ⏳ | — | `void` |
| 18 | GET | `/itinerary` | List all itineraries | ⏳ | — | `ApiPaginatedResponse<ItineraryResponse>` |
| 19 | GET | `/itinerary/:id` | Get single itinerary with days | ⏳ | — | `ItineraryResponse` |

### Itinerary Days

| # | Method | Endpoint | Description | Status | Request | Response |
|---|--------|----------|-------------|--------|---------|----------|
| 20 | POST | `/itinerary/:itineraryId/days` | Add a day to an itinerary | ✅ | `{ day_number, date?, title?, description?, location? }` | `ItineraryDayResponse` |
| 21 | PUT | `/itinerary/days/:dayId` | Update an itinerary day | ⏳ | `{ day_number?, date?, title?, description?, location? }` | `ItineraryDayResponse` |
| 22 | DELETE | `/itinerary/days/:dayId` | Remove a day from itinerary | ✅ | — | `void` |
| 23 | POST | `/itinerary/days/:dayId/destinations` | Link destination to a day with activities | ✅ | `{ destination_id, cost?, currency?, activities?, booking_url? }` | `any` |

### Itinerary Flights

| # | Method | Endpoint | Description | Status | Request | Response |
|---|--------|----------|-------------|--------|---------|----------|
| 24 | POST | `/itinerary/:itineraryId/flights` | Add a flight to an itinerary | ✅ | `{ airline?, flight_number?, departure_airport?, arrival_airport?, departure_datetime?, arrival_datetime?, cost?, currency?, booking_reference?, booking_url?, status? }` | `ItineraryFlightResponse` |
| 25 | PUT | `/itinerary/flights/:flightId` | Update an itinerary flight | ⏳ | `Partial<flight fields>` | `ItineraryFlightResponse` |
| 26 | DELETE | `/itinerary/flights/:flightId` | Remove a flight from itinerary | ✅ | — | `void` |

### Itinerary Accommodation

| # | Method | Endpoint | Description | Status | Request | Response |
|---|--------|----------|-------------|--------|---------|----------|
| 27 | POST | `/itinerary/:itineraryId/accommodation` | Add accommodation to itinerary | ⏳ | `{ accommodation_name, address?, check_in_date?, check_out_date?, room_type?, cost?, currency?, booking_reference?, booking_url?, status? }` | `ItineraryAccommodationResponse` |
| 28 | PUT | `/itinerary/accommodation/:accommodationId` | Update accommodation | ⏳ | `Partial<accommodation fields>` | `ItineraryAccommodationResponse` |
| 29 | DELETE | `/itinerary/accommodation/:accommodationId` | Remove accommodation | ⏳ | — | `void` |

### Destinations

| # | Method | Endpoint | Description | Status | Request | Response |
|---|--------|----------|-------------|--------|---------|----------|
| 30 | GET | `/destinations` | List destinations (for search dropdown) | ✅ | `?page=1` | `ApiPaginatedResponse<DestinationResponse>` |
| 31 | POST | `/destinations` | Create a new destination | ⏳ | `{ name, country?, url? }` | `DestinationResponse` |

> **Note:** Trip Detail also relies on mock data for: activities list (`ctx.getActivities()`), stays list (`ctx.getStays()`), call logs (`ctx.getCallLogs()`), and agent feed (`ctx.getAgentFeed()`). These have no corresponding API endpoints defined.

---

## Messages (`/app/messages`, `/app/messages/:convoId`)

| # | Method | Endpoint | Description | Status | Request | Response |
|---|--------|----------|-------------|--------|---------|----------|
| — | — | Conversations list | Fetch all conversations for inbox | ❌ | — | `Conversation[]` (currently mock data in `constants/app.ts`) |
| — | — | Messages for conversation | Fetch messages for a given conversation | ❌ | — | `Message[]` (currently mock data) |
| — | — | Send message | Post a new message to a conversation | ❌ | — | (not implemented) |
| — | — | Create trip from conversation | Convert a conversation to a trip | ❌ | — | (simulated in frontend only) |
| — | — | Mark conversation read | Update unread status | ❌ | — | (not implemented) |

> **Note:** Messages page uses **100% mock data**. No API endpoints have been defined for messaging yet.

---

## Travelers (`/app/travelers`)

| # | Method | Endpoint | Description | Status | Request | Response |
|---|--------|----------|-------------|--------|---------|----------|
| 32 | GET | `/customers` | List customers (paginated) | ✅ | `?page=1` | `ApiPaginatedResponse<CustomerResponse>` |
| 33 | GET | `/customers/:id` | Get single customer | ⏳ | — | `CustomerResponse` |
| 34 | POST | `/customers` | Create a new customer | ✅ | `{ company_id, first_name, last_name, email?, phone?, nationality?, date_of_birth?, passport_number?, notes? }` | `CustomerResponse` |
| 35 | PUT | `/customers/:id` | Update customer details | ✅ | `{ first_name?, last_name?, email?, phone?, nationality?, date_of_birth?, passport_number?, notes?, status? }` | `CustomerResponse` |
| 36 | DELETE | `/customers/:id` | Delete a customer | ✅ | — | `void` |

---

## Financials (`/app/financials`)

| # | Method | Endpoint | Description | Status | Request | Response |
|---|--------|----------|-------------|--------|---------|----------|
| 37 | GET | `/transactions` | List all transactions (paginated) | ✅ | `?page=1` | `ApiPaginatedResponse<TransactionResponse>` |
| 38 | GET | `/transactions/:id` | Get single transaction detail | ⏳ | — | `TransactionResponse` |
| 39 | POST | `/transactions/trip` | Record a trip payment | ⏳ | `{ trip_id, amount, currency?, payment_method?, transaction_reference?, notes?, status? }` | `TransactionResponse` |
| 40 | POST | `/transactions/subscription` | Record a subscription payment | ⏳ | `{ company_id, subscription_id, amount, currency?, payment_method?, transaction_reference?, status? }` | `TransactionResponse` |
| 41 | PUT | `/transactions/:id/status` | Update transaction status | ⏳ | `{ status }` | `TransactionResponse` |
| — | — | Invoice detail | Fetch full invoice data with breakdown | ❌ | — | `InvoiceDetail` (currently mock data in `constants/app.ts`) |
| — | — | Download invoice PDF | Generate/download invoice PDF | ❌ | — | (not implemented) |
| — | — | Send invoice reminder | Trigger payment reminder | ❌ | — | (simulated via toast only) |

> **Note:** Financials page computes stats and chart data client-side from the transactions list. Invoice detail modal uses mock data from `constants/app.ts`. Payment recording, status updates, and subscription endpoints are defined in `ApiService` but not wired.

---

## Settings (`/app/settings/:tab`)

### Profile Tab

| # | Method | Endpoint | Description | Status | Request | Response |
|---|--------|----------|-------------|--------|---------|----------|
| 42 | PUT | `/auth/profile` | Update current user profile | ✅ | `{ display_name?, phone?, avatar_url? }` | `UserProfile` (updated) |

### Workspace Tab

| # | Method | Endpoint | Description | Status | Request | Response |
|---|--------|----------|-------------|--------|---------|----------|
| 43 | GET | `/companies/:id` | Get company details with users | ✅ | — | `CompanyResponse` |
| 44 | PUT | `/companies/:id` | Update company settings | ✅ | `{ company_name?, country?, city_of_operation? }` | `CompanyResponse` |

### Team Tab

| # | Method | Endpoint | Description | Status | Request | Response |
|---|--------|----------|-------------|--------|---------|----------|
| 45 | GET | `/companies/:id` | Get company users (via `getCompanyUsers`) | ✅ | — | `CompanyResponse` (with `users: CompanyUser[]`) |
| 46 | POST | `/invitations` | Send team invitation | ✅ | `{ company_id, invited_by, email, role?, token, expires_at }` | `any` |
| — | — | Remove team member | Delete/disable a company user | ❌ | — | (not implemented) |
| — | — | Update team member role | Change user role in company | ❌ | — | (not implemented) |
| — | — | Seat usage & billing | Fetch seat counts, upgrade plan | ❌ | — | (currently hardcoded to 5 seats) |

### Roles Tab

| # | Method | Endpoint | Description | Status | Request | Response |
|---|--------|----------|-------------|--------|---------|----------|
| — | — | Roles/permissions definition | Fetch role definitions & permissions | ❌ | — | Roles data derived from company users; permission mapping is static in `Settings.tsx` |
| — | — | Update role permissions | Modify permissions for a role | ❌ | — | (not implemented) |

### Channels Tab

| # | Method | Endpoint | Description | Status | Request | Response |
|---|--------|----------|-------------|--------|---------|----------|
| — | — | List connected channels | Fetch current channel connections | ❌ | — | Static channel list in `Settings.tsx` |
| — | — | Connect channel | OAuth/QR flow to connect a channel | ❌ | — | Simulated in `ConnectChannelModal` — no real API calls |
| — | — | Disconnect channel | Remove a channel connection | ❌ | — | (not implemented) |

### Notifications Tab

| # | Method | Endpoint | Description | Status | Request | Response |
|---|--------|----------|-------------|--------|---------|----------|
| — | — | Get notification preferences | Fetch user notif settings | ❌ | — | Local state only in `Settings.tsx` |
| — | — | Update notification preferences | Save notif toggles | ❌ | — | (not implemented) |

---


## Pricing (`/app/pricing`)

| # | Method | Endpoint | Description | Status | Request | Response |
|---|--------|----------|-------------|--------|---------|----------|
| — | — | Current subscription | Fetch current plan & billing info | ❌ | — | `Plan` (mock data in `constants/app.ts`) |
| — | — | Available plans | Fetch pricing plans list | ❌ | — | `Plan[]` (mock data, billing toggle is local) |
| — | — | Change plan | Upgrade/downgrade subscription | ❌ | — | (not implemented) |
| — | — | Manage billing | Redirect to billing portal | ❌ | — | (not implemented) |

---

## Traveler View (`/travel/:tripId`)

| # | Method | Endpoint | Description | Status | Request | Response |
|---|--------|----------|-------------|--------|---------|----------|
| 47 | GET | `/trips/:id` | Load trip for public traveler view | ✅ | — | `TripResponse` |
| — | — | Accept trip | Traveler accepts the trip | ❌ | — | Simulated via toast only |
| — | — | Request changes | Traveler requests itinerary changes | ❌ | — | Simulated via toast only |

---

## Summary of Implementation Status

### Fully implemented API endpoints (✅ wired to UI)
`registerCompany`, `loginUser`, `googleLogin`, `requestPasswordReset`, `resetPassword`, `updateProfile`, `getDashboard`, `getTrips`, `getTrip`, `updateTrip`, `updateTripStatus`, `getTripCosts`, `createItinerary`, `addItineraryDay`, `removeItineraryDay`, `addFlight`, `removeFlight`, `addDestinationToDay`, `getCustomers`, `createCustomer`, `updateCustomer`, `deleteCustomer`, `getTransactions`, `getCompany`, `updateCompany`, `getCompanyUsers`, `sendInvitation`, `getDestinations`

### Defined in ApiService but NOT yet wired (⏳)
`getCustomer`, `getTransaction`, `recordTripPayment`, `recordSubscriptionPayment`, `updateTransactionStatus`, `createTrip`, `deleteTrip`, `updateItinerary`, `deleteItinerary`, `getItineraries`, `getItinerary`, `updateItineraryDay`, `updateFlight`, `addAccommodation`, `updateAccommodation`, `removeAccommodation`, `createDestination`

### Not yet implemented anywhere (❌)
All messaging/conversation endpoints, channel connection endpoints, guides content endpoints, subscription/pricing endpoints, notification preferences endpoints, invoice detail endpoint, team member management (remove/update role), traveler accept/request-changes endpoints, agent activity feed endpoint
