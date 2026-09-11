// ── API Service ──────────────────────────────────────────────
// Central HTTP service wrapping all backend endpoints. Handles auth token injection via
// axios interceptor and provides typed methods for auth, customers, transactions, trips,
// destinations, itineraries, days, flights, and accommodation CRUD operations.
//
// Not every method here is called from the UI yet — getItineraries/getItinerary/
// deleteItinerary/updateItineraryDay/updateFlight/updateAccommodation/getCustomer are fully
// wired to the backend but have no caller in src/pages or src/components today — they're here
// for whichever screen ends up needing them (e.g. a fuller "edit itinerary metadata" UI;
// updateItinerary itself IS used now, but only for its start_city field — see TripDetail.tsx's
// inline start-city editor). recordSubscriptionPayment is similarly unused now that
// Pricing.tsx pays through Paystack (initiatePaystackSubscriptionPayment) instead of recording
// a payment as already-completed — kept for a possible future "record an offline payment" flow.

import axios from 'axios';
import { confirmWeWireFallback, extractWeWireFallback } from './wewire-fallback';
import type { LoginResponse } from '../types/auth';
import type {
  DashboardResponse, ApiPaginatedResponse,
  CustomerResponse, TransactionResponse, TripResponse, TripCostResponse, ItineraryResponse, GenerateItineraryApiResponse,
  ItineraryDayResponse, ItineraryFlightResponse, ItineraryAccommodationResponse,
  DestinationResponse, AirportResponse, CompanyResponse, CallResponse, CallActionItemResponse,
  SubscriptionTierResponse, CompanySubscriptionResponse, PaystackCheckoutResponse,
  SuggestReplyResponse,
  FlightSearchResponse, HotelSearchResponse, CurrencyRatesResponse, GmailStatusResponse,
  ConversationResponse, MessageResponse, GmailThreadBrowseResponse, TripDetailsExtraction,
  VirtualAccountResponse, WeWireBeneficiaryResponse, PaymentPlanResponse, WeWireLookupResponse,
  WeWireInboundResponse, WeWireKycStatus, FundHandling,
  WeWireDisbursementResponse, DisbursementStatus, TripBalanceResponse, BeneficiaryType,
  WeWireCryptoWalletResponse,
} from '../types/app';
import { TripStatus, ItineraryStatus, FlightStatus, AccommodationStatus, TransactionStatus, CallActionItemStatus } from '../types/app';

export class ApiService {
  private static BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api';
  private static authToken: string | null = null;

  static {
    axios.interceptors.request.use((config) => {
      if (ApiService.authToken) {
        config.headers.Authorization = `Bearer ${ApiService.authToken}`;
      }
      return config;
    });
  }

  public static setAuthToken(token: string | null) {
    ApiService.authToken = token;
  }

  // POSTs a WeWire-backed endpoint; if the backend responds 409 with `requires_confirmation`
  // (see WeWireService::liveCall on the backend — the live call failed), shows the "Response
  // from wewire server" popup and, if the user accepts, resubmits the same request with
  // `confirm_simulated: true` so the backend proceeds using the simulated result it already
  // proposed. Any other error (validation, a plain 502 with no fallback offered, etc) just
  // propagates as usual.
  private static async postWithWeWireFallback<T>(url: string, data: Record<string, unknown>): Promise<T> {
    try {
      const res = await axios.post(url, data);
      return res.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        const fallback = extractWeWireFallback(error.response.data);
        if (fallback) {
          const accepted = await confirmWeWireFallback(fallback);
          if (accepted) {
            const res = await axios.post(url, { ...data, confirm_simulated: true });
            return res.data;
          }
        }
      }
      throw error;
    }
  }

  // ── Auth ──
  public static async registerCompany(userData: {
    email: string;
    company_name: string;
    country: string;
    business_type: 'llc' | string;
    username: string;
    password: string;
    password_confirmation: string;
  }): Promise<any> {
    const endpoint = `${ApiService.BASE_URL}/auth/register-company`;

    try {
      const response = await axios.post(endpoint, userData);
      return response.data;
    } catch (error) {
      console.error('Error during company registration:', error);
      let errorMessage = 'Failed to register company.';
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data.message || errorMessage;
      }
      throw new Error(errorMessage);
    }
  }

  public static async loginUser(loginData: {
    email: string;
    password: string;
  }): Promise<LoginResponse> {
    const endpoint = `${ApiService.BASE_URL}/auth/login`;

    try {
      const response = await axios.post(endpoint, loginData);
      return response.data;
    } catch (error) {
      console.error('Error during user login:', error);
      let errorMessage = 'Failed to log in.';
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data.message || errorMessage;
      }
      throw new Error(errorMessage);
    }
  }

  public static async googleLogin(google: {
    idToken: string;
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  }): Promise<LoginResponse> {
    const endpoint = `${ApiService.BASE_URL}/auth/login`

    try {
      const response = await axios.post(endpoint, {
        provider_token: google.idToken,
        email: google.email,
        display_name: google.displayName,
        avatar_url: google.avatarUrl,
      })
      return response.data
    } catch (error) {
      console.error('Error during Google sign-in:', error)
      let errorMessage = 'Failed to sign in with Google.'
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data.message || errorMessage
      }
      throw new Error(errorMessage)
    }
  }

  public static async requestPasswordReset( email : {
	email: string;
  }) : Promise<any> {
	const endpoint = `${ApiService.BASE_URL}/auth/forgot-password`;

	try {
		const response = await axios.post(endpoint, email);
		return response.data;
	} catch (error){
		console.log("An error occured when requesting for password reset",error);
		let errorMessage = "Failed to request a reset link";
		if (axios.isAxiosError(error) && error.message){
			errorMessage = error.response?.data.message || errorMessage;
		}
		throw new Error(errorMessage);
	}
  }


    public static async resetPassword( credentials : {
	email: string;
	token: string;
	password: string;
  password_confirmation: string;

  }) : Promise<any> {
	const endpoint = `${ApiService.BASE_URL}/auth/reset-password`;

	try {
		const response = await axios.post(endpoint, credentials);
		return response.data;
	} catch (error){
		console.log("An error occured when resetting the password",error);
		let errorMessage = "Failed to reset password";
		if (axios.isAxiosError(error) && error.message){
			errorMessage = error.response?.data.message || errorMessage;
		}
		throw new Error(errorMessage);
	}
  }

  public static async getMe(): Promise<{ user: LoginResponse['user'] }> {
    const response = await axios.get(`${ApiService.BASE_URL}/auth/me`);
    return response.data;
  }

  public static async updateProfile(payload: {
    display_name?: string;
    phone?: string | null;
    avatar_url?: string | null;
  }): Promise<LoginResponse['user']> {
    const endpoint = `${ApiService.BASE_URL}/auth/profile`;

    try {
      const response = await axios.put(endpoint, payload);
      return response.data;
    } catch (error) {
      console.error('Error updating profile:', error);
      let errorMessage = 'Failed to update profile.';
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data.message || errorMessage;
      }
      throw new Error(errorMessage);
    }
  }

  // ── Dashboard ──
  public static async getDashboard(): Promise<DashboardResponse> {
    const endpoint = `${ApiService.BASE_URL}/dashboard`;

    try {
      const response = await axios.get(endpoint);
      return response.data;
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      let errorMessage = 'Failed to fetch dashboard data.';
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data.message || errorMessage;
      }
      throw new Error(errorMessage);
    }
  }

  // ── Customers ──
  public static async getCustomers(page = 1): Promise<ApiPaginatedResponse<CustomerResponse>> {
    const res = await axios.get(`${ApiService.BASE_URL}/customers?page=${page}`);
    return res.data;
  }

  public static async getCustomer(id: string): Promise<CustomerResponse> {
    const res = await axios.get(`${ApiService.BASE_URL}/customers/${id}`);
    return res.data;
  }

  public static async createCustomer(data: {
    company_id: string;
    first_name: string;
    last_name: string;
    email?: string | null;
    phone?: string | null;
    nationality?: string | null;
    date_of_birth?: string | null;
    passport_number?: string | null;
    notes?: string | null;
  }): Promise<CustomerResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/customers`, data);
    return res.data;
  }

  public static async updateCustomer(id: string, data: Partial<{
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    nationality: string | null;
    date_of_birth: string | null;
    passport_number: string | null;
    notes: string | null;
    status: string;
  }>): Promise<CustomerResponse> {
    const res = await axios.put(`${ApiService.BASE_URL}/customers/${id}`, data);
    return res.data;
  }

  public static async deleteCustomer(id: string): Promise<void> {
    await axios.delete(`${ApiService.BASE_URL}/customers/${id}`);
  }

  // ── Transactions ──
  public static async getTransactions(page = 1): Promise<ApiPaginatedResponse<TransactionResponse>> {
    const res = await axios.get(`${ApiService.BASE_URL}/transactions?page=${page}`);
    return res.data;
  }

  public static async getTransaction(id: string): Promise<TransactionResponse> {
    const res = await axios.get(`${ApiService.BASE_URL}/transactions/${id}`);
    return res.data;
  }

  public static async recordTripPayment(data: {
    trip_id: string;
    amount: number;
    currency?: string;
    payment_method?: string;
    transaction_reference?: string;
    notes?: string;
    status?: TransactionStatus;
  }): Promise<TransactionResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/transactions/trip`, data);
    return res.data;
  }

  public static async recordSubscriptionPayment(data: {
    company_id: string;
    subscription_id: string;
    amount: number;
    currency?: string;
    payment_method?: string;
    transaction_reference?: string;
    status?: TransactionStatus;
  }): Promise<TransactionResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/transactions/subscription`, data);
    return res.data;
  }

  public static async updateTransactionStatus(id: string, status: TransactionStatus): Promise<TransactionResponse> {
    const res = await axios.put(`${ApiService.BASE_URL}/transactions/${id}/status`, { status });
    return res.data;
  }

  // ── Trips ──
  public static async getTrips(page = 1): Promise<ApiPaginatedResponse<TripResponse>> {
    const res = await axios.get(`${ApiService.BASE_URL}/trips?page=${page}`);
    return res.data;
  }

  public static async getTrip(id: string): Promise<TripResponse> {
    const res = await axios.get(`${ApiService.BASE_URL}/trips/${id}`);
    return res.data;
  }

  public static async createTrip(data: {
    company_id: string;
    created_by?: string;
    trip_name: string;
    description?: string;
    start_date?: string;
    end_date?: string;
    budget?: string;
    status?: TripStatus;
  }): Promise<TripResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/trips`, data);
    return res.data;
  }

  public static async updateTrip(id: string, data: Partial<{
    trip_name: string;
    description: string;
    start_date: string;
    end_date: string;
    budget: string;
    status: TripStatus;
  }>): Promise<TripResponse> {
    const res = await axios.put(`${ApiService.BASE_URL}/trips/${id}`, data);
    return res.data;
  }

  public static async deleteTrip(id: string): Promise<void> {
    await axios.delete(`${ApiService.BASE_URL}/trips/${id}`);
  }

  public static async updateTripStatus(id: string, status: TripStatus): Promise<TripResponse> {
    const res = await axios.patch(`${ApiService.BASE_URL}/trips/${id}/status`, { status });
    return res.data;
  }

  public static async getTripCosts(id: string): Promise<TripCostResponse> {
    const res = await axios.get(`${ApiService.BASE_URL}/trips/${id}/costs`);
    return res.data;
  }

  public static async generateItinerary(id: string, preferences?: {
    budget?: string;
    style?: string;
    priorities?: string[];
    notes?: string;
    start_city?: string;
    model?: string;
    include_flights?: boolean;
    include_stays?: boolean;
    include_events?: boolean;
    flight_departure_time?: string;
    return_flight_time?: string;
    flight_legs?: { label: string; date: string; time: string }[];
  }): Promise<GenerateItineraryApiResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/trips/${id}/generate-itinerary`, preferences ?? {});
    return res.data;
  }

  // Attaches a customer to a trip as its traveler (role defaults to 'primary' server-side).
  // Was already routed on the backend (TripController::addCustomer/removeCustomer) but never
  // exposed here — nothing in the UI could assign a traveler to a trip before this.
  public static async addCustomerToTrip(tripId: string, customerId: string, role?: 'primary' | 'companion'): Promise<TripResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/trips/${tripId}/customers`, { customer_id: customerId, role });
    return res.data;
  }

  public static async removeCustomerFromTrip(tripId: string, customerId: string): Promise<void> {
    await axios.delete(`${ApiService.BASE_URL}/trips/${tripId}/customers/${customerId}`);
  }

  // ── Company ──
  public static async createCompany(data: {
    company_name: string;
    country: string;
    business_type: string;
  }): Promise<CompanyResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/companies`, data);
    return res.data;
  }

  public static async getCompany(id: string): Promise<CompanyResponse> {
    const res = await axios.get(`${ApiService.BASE_URL}/companies/${id}`);
    return res.data;
  }

  public static async updateCompany(id: string, data: Partial<{
    company_name: string;
    country: string;
    city_of_operation: string;
    preferred_currency: string;
  }>): Promise<CompanyResponse> {
    const res = await axios.put(`${ApiService.BASE_URL}/companies/${id}`, data);
    return res.data;
  }

  // ── Users (scoped to company) ──
  public static async getCompanyUsers(companyId: string): Promise<CompanyResponse> {
    return ApiService.getCompany(companyId);
  }

  // ── Invitations ──
  public static async sendInvitation(data: {
    company_id: string;
    invited_by: string;
    email: string;
    role?: string;
  }): Promise<any> {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await axios.post(`${ApiService.BASE_URL}/invitations`, {
      ...data,
      token,
      expires_at: expiresAt,
    });
    return res.data;
  }

  // ── Destinations ──
  public static async getDestinations(page = 1): Promise<ApiPaginatedResponse<DestinationResponse>> {
    const res = await axios.get(`${ApiService.BASE_URL}/destinations?page=${page}`);
    return res.data;
  }

  public static async createDestination(data: {
    name: string;
    country: string;
    url?: string;
  }): Promise<DestinationResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/destinations`, data);
    return res.data;
  }

  // ── Airports ──
  // City/country → IATA code lookup (see AirportController::search) — used by AddFlightModal's
  // From/To fields so agents don't need to memorize airport codes.
  public static async searchAirports(query: string): Promise<{ data: AirportResponse[] }> {
    const res = await axios.get(`${ApiService.BASE_URL}/airports/search`, { params: { q: query } });
    return res.data;
  }

  // ── Itinerary ──
  public static async getItineraries(): Promise<ApiPaginatedResponse<ItineraryResponse>> {
    const res = await axios.get(`${ApiService.BASE_URL}/itinerary`);
    return res.data;
  }

  public static async getItinerary(id: string): Promise<ItineraryResponse> {
    const res = await axios.get(`${ApiService.BASE_URL}/itinerary/${id}`);
    return res.data;
  }

  public static async createItinerary(data: {
    trip_id: string;
    created_by?: string;
    itinerary_name: string;
    start_city?: string;
    description?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<ItineraryResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/itinerary`, data);
    return res.data;
  }

  public static async updateItinerary(id: string, data: Partial<{
    itinerary_name: string;
    start_city: string;
    description: string;
    start_date: string;
    end_date: string;
    status: ItineraryStatus;
  }>): Promise<ItineraryResponse> {
    const res = await axios.put(`${ApiService.BASE_URL}/itinerary/${id}`, data);
    return res.data;
  }

  public static async deleteItinerary(id: string): Promise<void> {
    await axios.delete(`${ApiService.BASE_URL}/itinerary/${id}`);
  }

  // ── Itinerary Days ──
  public static async addItineraryDay(itineraryId: string, data: {
    day_number: number;
    date?: string;
    title?: string;
    description?: string;
    location?: string;
  }): Promise<ItineraryDayResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/itinerary/${itineraryId}/days`, data);
    return res.data;
  }

  public static async updateItineraryDay(dayId: string, data: Partial<{
    day_number: number;
    date: string;
    title: string;
    description: string;
    location: string;
  }>): Promise<ItineraryDayResponse> {
    const res = await axios.put(`${ApiService.BASE_URL}/itinerary/days/${dayId}`, data);
    return res.data;
  }

  public static async removeItineraryDay(dayId: string): Promise<void> {
    await axios.delete(`${ApiService.BASE_URL}/itinerary/days/${dayId}`);
  }

  // ── Itinerary Flights ──
  public static async addFlight(itineraryId: string, data: {
    airline?: string;
    flight_number?: string;
    departure_airport?: string;
    arrival_airport?: string;
    departure_datetime?: string;
    arrival_datetime?: string;
    cost?: number;
    currency?: string;
    booking_reference?: string;
    booking_url?: string;
    status?: FlightStatus;
  }): Promise<ItineraryFlightResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/itinerary/${itineraryId}/flights`, data);
    return res.data;
  }

  public static async updateFlight(flightId: string, data: Partial<{
    airline: string;
    flight_number: string;
    departure_airport: string;
    arrival_airport: string;
    departure_datetime: string;
    arrival_datetime: string;
    cost: number;
    currency: string;
    booking_reference: string;
    booking_url: string;
    status: FlightStatus;
  }>): Promise<ItineraryFlightResponse> {
    const res = await axios.put(`${ApiService.BASE_URL}/itinerary/flights/${flightId}`, data);
    return res.data;
  }

  public static async removeFlight(flightId: string): Promise<void> {
    await axios.delete(`${ApiService.BASE_URL}/itinerary/flights/${flightId}`);
  }

  // Real flight search via SerpApi's Google Flights engine (server-side — see
  // ItineraryController::searchFlights). Read-only; call addFlight() once per leg of
  // whichever FlightSearchResult the user picks to actually save it.
  public static async searchFlights(itineraryId: string, params: {
    departure_id: string;
    arrival_id: string;
    outbound_date: string;
    return_date?: string;
  }): Promise<FlightSearchResponse> {
    const res = await axios.get(`${ApiService.BASE_URL}/itinerary/${itineraryId}/flights/search`, { params });
    return res.data;
  }

  // ── Itinerary Accommodation ──
  public static async addAccommodation(itineraryId: string, data: {
    accommodation_name: string;
    address?: string;
    check_in_date?: string;
    check_out_date?: string;
    room_type?: string;
    cost?: number;
    currency?: string;
    booking_reference?: string;
    booking_url?: string;
    status?: AccommodationStatus;
  }): Promise<ItineraryAccommodationResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/itinerary/${itineraryId}/accommodation`, data);
    return res.data;
  }

  public static async updateAccommodation(accommodationId: string, data: Partial<{
    accommodation_name: string;
    address: string;
    check_in_date: string;
    check_out_date: string;
    room_type: string;
    cost: number;
    currency: string;
    booking_reference: string;
    booking_url: string;
    status: AccommodationStatus;
  }>): Promise<ItineraryAccommodationResponse> {
    const res = await axios.put(`${ApiService.BASE_URL}/itinerary/accommodation/${accommodationId}`, data);
    return res.data;
  }

  public static async removeAccommodation(accommodationId: string): Promise<void> {
    await axios.delete(`${ApiService.BASE_URL}/itinerary/accommodation/${accommodationId}`);
  }

  // Real hotel/stay search via SerpApi's Google Hotels engine (server-side — see
  // ItineraryController::searchHotels). Read-only; call addAccommodation() with the picked
  // HotelSearchResult's fields to actually save it.
  public static async searchHotels(itineraryId: string, params: {
    q: string;
    check_in_date: string;
    check_out_date: string;
    adults?: number;
  }): Promise<HotelSearchResponse> {
    const res = await axios.get(`${ApiService.BASE_URL}/itinerary/${itineraryId}/accommodation/search`, { params });
    return res.data;
  }

  // ── Itinerary Day Destinations ──
  // Links a destination to a specific itinerary day with optional cost/activity/booking info
  public static async addDestinationToDay(dayId: string, data: {
    destination_id: string;
    item_type?: 'activity' | 'dining' | 'transfer' | 'venue';
    cost?: string;
    currency?: string;
    activities?: string;
    booking_url?: string;
  }): Promise<any> {
    const res = await axios.post(`${ApiService.BASE_URL}/itinerary/days/${dayId}/destinations`, data);
    return res.data;
  }

  // Removes a single destination from a day, without deleting the day itself — see
  // ItineraryController::removeDestinationFromDay on the backend.
  public static async removeDestinationFromDay(dayId: string, destinationId: string): Promise<void> {
    await axios.delete(`${ApiService.BASE_URL}/itinerary/days/${dayId}/destinations/${destinationId}`);
  }

  // ── Calls ──
  // Optional tripId scopes the list to one trip — used by TripDetail.tsx's Calls tab.
  public static async getCalls(tripId?: string): Promise<ApiPaginatedResponse<CallResponse>> {
    const res = await axios.get(`${ApiService.BASE_URL}/calls`, {
      params: tripId ? { trip_id: tripId } : undefined,
    });
    return res.data;
  }

  public static async getCall(id: string): Promise<CallResponse> {
    const res = await axios.get(`${ApiService.BASE_URL}/calls/${id}`);
    return res.data;
  }

  public static async createCall(data: {
    trip_id: string;
    organized_by?: string;
    title?: string;
    started_at?: string;
    meeting_link?: string;
  }): Promise<CallResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/calls`, data);
    return res.data;
  }

  public static async updateCall(id: string, data: Partial<{
    title: string;
    started_at: string;
    ended_at: string;
    meeting_link: string;
    notes: string;
    transcript: string;
    excluded: boolean;
  }>): Promise<CallResponse> {
    const res = await axios.put(`${ApiService.BASE_URL}/calls/${id}`, data);
    return res.data;
  }

  // Creates a real Google Calendar event with an auto-generated Meet link (via the company's
  // connected Google account) plus a matching Call row. 422s if Calendar isn't connected+enabled.
  public static async scheduleCallWithMeet(tripId: string, data: {
    title: string;
    started_at: string;
    ended_at: string;
    customer_id: string;
  }): Promise<CallResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/trips/${tripId}/calls/schedule`, data);
    return res.data;
  }

  public static async deleteCall(id: string): Promise<void> {
    await axios.delete(`${ApiService.BASE_URL}/calls/${id}`);
  }

  public static async endCall(id: string): Promise<CallResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/calls/${id}/end`);
    return res.data;
  }

  public static async addCallActionItem(callId: string, description: string): Promise<CallActionItemResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/calls/${callId}/action-items`, { description });
    return res.data;
  }

  public static async updateCallActionItem(id: string, data: Partial<{
    description: string;
    status: CallActionItemStatus;
  }>): Promise<CallActionItemResponse> {
    const res = await axios.put(`${ApiService.BASE_URL}/calls/action-items/${id}`, data);
    return res.data;
  }

  public static async removeCallActionItem(id: string): Promise<void> {
    await axios.delete(`${ApiService.BASE_URL}/calls/action-items/${id}`);
  }

  // ── Subscriptions ──
  public static async getSubscriptionTiers(): Promise<ApiPaginatedResponse<SubscriptionTierResponse>> {
    const res = await axios.get(`${ApiService.BASE_URL}/subscription-tiers`);
    return res.data;
  }

  // Returns the caller's own company's subscription history (most recent first) —
  // CompanySubscriptionController::index is scoped server-side, no company_id needed here.
  public static async getCompanySubscriptions(): Promise<ApiPaginatedResponse<CompanySubscriptionResponse>> {
    const res = await axios.get(`${ApiService.BASE_URL}/company-subscriptions`);
    return res.data;
  }

  // Subscribes the caller's own company to a tier. Does not record a payment — call
  // recordSubscriptionPayment() separately with the returned subscription_id for that.
  public static async subscribeToTier(data: {
    tier_id: string;
    start_date: string;
    end_date: string;
    status?: string;
  }): Promise<CompanySubscriptionResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/company-subscriptions`, data);
    return res.data;
  }

  // ── WeWire payments (https://docs.wewire.com/) ──
  // Multi-currency virtual accounts (up to 3 per company) and trip installment plans. WeWire
  // has no hosted checkout link — collection happens via the company's own
  // virtual account bank details, shown on the public /pay/:reference page (see
  // lookupWeWirePaymentByReference below) and reconciled server-side by reference code.
  public static async registerWeWireSubCustomer(data: { email: string; country: string; business_type: string }): Promise<{ wewire_subcustomer_id: string; wewire_kyc_status: WeWireKycStatus }> {
    const res = await axios.post(`${ApiService.BASE_URL}/wewire/subcustomer`, data);
    return res.data;
  }

  public static async submitWeWireKyc(data: Record<string, unknown>): Promise<{ wewire_kyc_status: WeWireKycStatus; hosted_owner_kyc_link?: string | null }> {
    const res = await axios.post(`${ApiService.BASE_URL}/wewire/subcustomer/kyc`, data);
    return res.data;
  }

  public static async getWeWireStatus(): Promise<{ wewire_subcustomer_id: string | null; wewire_kyc_status: WeWireKycStatus }> {
    const res = await axios.get(`${ApiService.BASE_URL}/wewire/subcustomer`);
    return res.data;
  }

  public static async getWeWireAccounts(): Promise<VirtualAccountResponse[]> {
    const res = await axios.get(`${ApiService.BASE_URL}/wewire/accounts`);
    return res.data;
  }

  public static async createWeWireAccount(currency: string): Promise<VirtualAccountResponse> {
    return ApiService.postWithWeWireFallback(`${ApiService.BASE_URL}/wewire/accounts`, { currency });
  }

  public static async updateWeWireAccount(accountId: string, data: { fund_handling?: FundHandling; beneficiary_account_id?: string | null }): Promise<VirtualAccountResponse> {
    const res = await axios.put(`${ApiService.BASE_URL}/wewire/accounts/${accountId}`, data);
    return res.data;
  }

  // ── WeWire crypto wallets — same shape as the bank/mobile-money virtual accounts above,
  // just for stablecoin deposits. See WeWireCryptoWalletController.
  public static async getWeWireWallets(): Promise<WeWireCryptoWalletResponse[]> {
    const res = await axios.get(`${ApiService.BASE_URL}/wewire/wallets`);
    return res.data;
  }

  // WeWire's own catalog of which (asset, chain) pairs are currently offered — shape isn't
  // fully pinned down (WeWire's docs don't give a full example), so this is passed through
  // as-is; the caller should treat it defensively.
  public static async getWeWireSupportedWalletAssets(): Promise<unknown> {
    const res = await axios.get(`${ApiService.BASE_URL}/wewire/wallets/supported-assets`);
    return res.data;
  }

  public static async createWeWireWallet(asset: string, chain: string): Promise<WeWireCryptoWalletResponse> {
    return ApiService.postWithWeWireFallback(`${ApiService.BASE_URL}/wewire/wallets`, { asset, chain });
  }

  public static async getWeWireBeneficiaries(type?: BeneficiaryType): Promise<WeWireBeneficiaryResponse[]> {
    const res = await axios.get(`${ApiService.BASE_URL}/wewire/beneficiaries`, { params: type ? { type } : {} });
    return res.data;
  }

  public static async createWeWireBeneficiary(data: Record<string, unknown>): Promise<WeWireBeneficiaryResponse> {
    return ApiService.postWithWeWireFallback(`${ApiService.BASE_URL}/wewire/beneficiaries`, data);
  }

  public static async createPaymentPlan(tripId: string, data: { total_amount: number; currency: string; installments: { amount: number; due_date?: string | null }[] }): Promise<PaymentPlanResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/trips/${tripId}/payment-plan`, data);
    return res.data;
  }

  public static async getPaymentPlan(tripId: string): Promise<PaymentPlanResponse | null> {
    try {
      const res = await axios.get(`${ApiService.BASE_URL}/trips/${tripId}/payment-plan`);
      return res.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  public static async updatePaymentPlanReference(planId: string, paymentReference: string): Promise<PaymentPlanResponse> {
    const res = await axios.patch(`${ApiService.BASE_URL}/payment-plans/${planId}/reference`, { payment_reference: paymentReference });
    return res.data;
  }

  public static async getWeWireInboundQueue(status: 'unmatched' | 'all' = 'unmatched'): Promise<{ data: WeWireInboundResponse[] }> {
    const res = await axios.get(`${ApiService.BASE_URL}/wewire/inbound`, { params: { status } });
    return res.data;
  }

  public static async matchWeWireInbound(inboundId: string, installmentId: string): Promise<WeWireInboundResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/wewire/inbound/${inboundId}/match`, { installment_id: installmentId });
    return res.data;
  }

  public static async getWeWireDisbursements(status?: DisbursementStatus): Promise<{ data: WeWireDisbursementResponse[] }> {
    const res = await axios.get(`${ApiService.BASE_URL}/wewire/disbursements`, { params: status ? { status } : {} });
    return res.data;
  }

  public static async retryWeWireDisbursement(disbursementId: string): Promise<WeWireDisbursementResponse> {
    return ApiService.postWithWeWireFallback(`${ApiService.BASE_URL}/wewire/disbursements/${disbursementId}/retry`, {});
  }

  // Trips with money still held from WeWire collections, for the Dashboard's "Pay out
  // agency" panel — see WeWirePaymentController::tripBalances/payoutTrip.
  public static async getWeWireTripBalances(): Promise<TripBalanceResponse[]> {
    const res = await axios.get(`${ApiService.BASE_URL}/wewire/trip-balances`);
    return res.data;
  }

  public static async payoutTrip(tripId: string, data: {
    beneficiary_id: string;
    amount?: number;
    line_item_type?: 'flight' | 'accommodation' | 'activity';
    line_item_id?: string;
    line_item_label?: string;
  }): Promise<WeWireDisbursementResponse> {
    return ApiService.postWithWeWireFallback(`${ApiService.BASE_URL}/trips/${tripId}/payout`, data);
  }

  // Public — the /pay/:reference page's data source. No auth required, same trust model as
  // the /travel/:tripId public trip endpoints (the reference code is the "credential").
  public static async lookupWeWirePaymentByReference(reference: string): Promise<WeWireLookupResponse> {
    const res = await axios.get(`${ApiService.BASE_URL}/public/payments/wewire/lookup/${reference}`);
    return res.data;
  }

  // The /pay/:reference page's "Proceed with payment" button — only works while WeWire is in
  // simulation mode server-side (WEWIRE_SIMULATE). Stands in for the customer's bank transfer
  // and returns the same shape as lookupWeWirePaymentByReference so the page can just swap it in.
  // The "Proceed with payment" button on the public /pay/:reference page. Actually attempts a
  // real WeWire check (is the receiving virtual account genuinely ACTIVE right now?) before
  // anything is faked — see WeWirePaymentController::simulatePublicPayment. A verified account
  // returns `{ ...lookup, verified: true }` with nothing simulated; a failed check goes through
  // the same "Response from wewire server" popup as every other WeWire-backed action
  // (postWithWeWireFallback), and only settles a simulated payment if the customer accepts it.
  public static async attemptWeWirePayment(reference: string, currency?: string): Promise<WeWireLookupResponse> {
    return ApiService.postWithWeWireFallback(`${ApiService.BASE_URL}/public/payments/wewire/simulate/${reference}`, currency ? { currency } : {});
  }

  // ── Paystack payments (https://paystack.com/docs/) ──
  // Used for tour operator subscription payments — see PaystackPaymentController. This single
  // call both creates the (pending) subscription and starts the hosted checkout, since a
  // subscription shouldn't be marked active until payment is confirmed. Payment completion is
  // confirmed by polling checkPaystackPaymentStatus() from the page the customer lands back on
  // (see PaymentCallback.tsx).
  public static async initiatePaystackSubscriptionPayment(tierId: string): Promise<PaystackCheckoutResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/payments/paystack/subscription`, { tier_id: tierId });
    return res.data;
  }

  public static async checkPaystackPaymentStatus(transactionId: string): Promise<TransactionResponse> {
    const res = await axios.get(`${ApiService.BASE_URL}/payments/paystack/${transactionId}/status`);
    return res.data;
  }

  // ── Public traveler endpoints (no auth required — reachable via the shareable
  // /travel/:tripId link, see TravelerView.tsx) ──
  public static async getPublicTrip(tripId: string): Promise<TripResponse> {
    const res = await axios.get(`${ApiService.BASE_URL}/public/trips/${tripId}`);
    return res.data;
  }

  public static async getPublicTripCosts(tripId: string): Promise<TripCostResponse> {
    const res = await axios.get(`${ApiService.BASE_URL}/public/trips/${tripId}/costs`);
    return res.data;
  }

  // Marks an itinerary option as the one the traveler chose — the actual mutation behind
  // TravelerView.tsx's "Accept this option" button. Public (no auth), unlike updateItinerary()
  // above, since a traveler viewing the shareable /travel/:tripId link has no Meridian account.
  // Also what auto-creates the trip's default WeWire payment plans on the backend (see
  // TripController::acceptItinerary / DefaultPaymentPlanService).
  public static async acceptPublicItinerary(tripId: string, itineraryId: string): Promise<ItineraryResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/public/trips/${tripId}/itineraries/${itineraryId}/accept`);
    return res.data;
  }

  // ── Currency ──
  // Public, static conversion table (see CurrencyController on the backend) — used by
  // CurrencyContext to convert every displayed amount into the caller's preferred currency.
  public static async getCurrencyRates(): Promise<CurrencyRatesResponse> {
    const res = await axios.get(`${ApiService.BASE_URL}/currency-rates`);
    return res.data;
  }

  // ── Gmail / Calendar (Settings > Channels) ──
  // Gmail and Calendar share one connected Google account per company — `app` picks which
  // scopes this particular connect/disconnect call is for (see GmailController). getGmailAuthUrl
  // returns Google's consent URL; the caller does `window.location.href = url` itself rather
  // than the browser following an XHR redirect, since a Bearer token can't ride along on a real
  // navigation (see GmailController's docblock on the backend).
  public static async getGmailAuthUrl(app: 'gmail' | 'calendar' = 'gmail'): Promise<string> {
    const res = await axios.get(`${ApiService.BASE_URL}/gmail/connect?app=${app}`);
    return res.data.url;
  }

  public static async getGmailStatus(): Promise<GmailStatusResponse> {
    const res = await axios.get(`${ApiService.BASE_URL}/gmail/status`);
    return res.data;
  }

  public static async disconnectGmail(app: 'gmail' | 'calendar' = 'gmail'): Promise<void> {
    await axios.post(`${ApiService.BASE_URL}/gmail/disconnect?app=${app}`);
  }

  // Toggles Meet call tracking on top of an already-connected Calendar — no OAuth round-trip,
  // just a feature flag (see GmailController::updateMeetTracking). 422s if Calendar isn't
  // connected yet.
  public static async updateMeetTracking(enabled: boolean): Promise<{ meet_tracking_enabled: boolean }> {
    const res = await axios.patch(`${ApiService.BASE_URL}/gmail/meet-tracking`, { enabled });
    return res.data;
  }

  // ── Conversations (Messages page) ──
  public static async getConversations(): Promise<ConversationResponse[]> {
    const res = await axios.get(`${ApiService.BASE_URL}/conversations`);
    return res.data;
  }

  // Full thread (messages included) — the list endpoint above deliberately omits message
  // bodies, so this is called on demand once the agent opens a specific conversation.
  public static async getConversation(id: string): Promise<ConversationResponse> {
    const res = await axios.get(`${ApiService.BASE_URL}/conversations/${id}`);
    return res.data;
  }

  // tripId null unlinks the conversation from whatever trip it was attached to.
  public static async linkConversationToTrip(id: string, tripId: string | null): Promise<ConversationResponse> {
    const res = await axios.patch(`${ApiService.BASE_URL}/conversations/${id}`, { trip_id: tripId });
    return res.data;
  }

  // Untrack — removes the conversation (and its messages) from Meridian only; never touches
  // the source mailbox. Re-adding it later (AddGmailThreadModal) re-syncs from scratch.
  public static async untrackConversation(id: string): Promise<void> {
    await axios.delete(`${ApiService.BASE_URL}/conversations/${id}`);
  }

  // Sends a real reply into the tracked Gmail thread (ConversationController::sendMessage) —
  // not a mock/local-only action. Server message surfaced on failure (e.g. "Connect Gmail in
  // Settings first.") since it's directly actionable for the agent.
  public static async sendConversationMessage(id: string, body: string): Promise<MessageResponse> {
    try {
      const res = await axios.post(`${ApiService.BASE_URL}/conversations/${id}/messages`, { body });
      return res.data;
    } catch (error) {
      let errorMessage = 'Failed to send your reply.';
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data.message || errorMessage;
      }
      throw new Error(errorMessage);
    }
  }

  // Asks meridian-ai for draft reply suggestions for this thread — only called when the agent
  // clicks "Suggest reply" (see Messages.tsx), never automatically.
  public static async suggestReply(id: string): Promise<SuggestReplyResponse> {
    try {
      const res = await axios.post(`${ApiService.BASE_URL}/conversations/${id}/suggest-reply`);
      return res.data;
    } catch (error) {
      let errorMessage = 'Failed to draft a suggestion.';
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data.message || errorMessage;
      }
      throw new Error(errorMessage);
    }
  }


  // Asks meridian-ai for message draft to request for more details for this thread
  // — only called when the agent  clicks "Suggest reply" (see Messages.tsx), never automatically.
  public static async requestTravelDetails(id: string): Promise<SuggestReplyResponse> {
    try {
      const res = await axios.post(`${ApiService.BASE_URL}/conversations/${id}/request-travel-details`);
      return res.data;
    } catch (error) {
      let errorMessage = 'Failed to draft a suggestion.';
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data.message || errorMessage;
      }
      throw new Error(errorMessage);
    }
  }

  // "Create trip from this chat" (see Messages.tsx / CreateTripModal.tsx) — reads the thread
  // and returns a prefilled (not blank) trip form for the agent to review before creating.
  public static async extractTripDetails(id: string): Promise<TripDetailsExtraction> {
    try {
      const res = await axios.post(`${ApiService.BASE_URL}/conversations/${id}/extract-trip-details`);
      return res.data;
    } catch (error) {
      let errorMessage = "Couldn't read this conversation to prefill the trip.";
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data.message || errorMessage;
      }
      throw new Error(errorMessage);
    }
  }

  // ── Gmail threads (Messages page "+ Add" picker) ──
  // Candidate threads not already tracked — see GmailThreadController for why nothing syncs
  // automatically. 422s with a message if Gmail isn't connected yet.
  public static async browseGmailThreads(q?: string, pageToken?: string): Promise<GmailThreadBrowseResponse> {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (pageToken) params.set('page_token', pageToken);
    const res = await axios.get(`${ApiService.BASE_URL}/gmail/threads/browse?${params.toString()}`);
    return res.data;
  }

  // Idempotent — re-adding an already-tracked thread just returns it.
  public static async addGmailThread(threadId: string): Promise<ConversationResponse> {
    const res = await axios.post(`${ApiService.BASE_URL}/gmail/threads`, { thread_id: threadId });
    return res.data;
  }
}
